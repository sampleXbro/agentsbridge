import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AddLessonInput } from './add.js';
import type { Lesson, Topic, Trigger } from './graph-schema.js';
import {
  collectClusterTriggerIds,
  deleteLegacyArtifacts,
  LegacyIndexSchema,
  parseRulesSection,
} from './import-legacy-parse.js';
import { mergeLegacy } from './import-legacy-merge.js';
import { lessonsPaths } from './paths.js';
import { mutateLessonsGraphLocked } from './mutate.js';

export interface ImportLegacyOptions {
  /** ISO date stamped onto every imported lesson's `createdAt`. */
  readonly migratedAt: string;
  /**
   * When `true` (default), delete the legacy `index.yaml`, `journal.md`,
   * `topics/`, `distill-ledger.yaml`, and `distill-proposal.md` after a
   * successful migration. Pass `false` to leave them in place (test-only).
   */
  readonly deleteLegacy?: boolean;
  /**
   * Overwrite an existing non-empty graph. Default `false`: migration refuses
   * (throws {@link LessonsGraphExistsError}) when, AT WRITE TIME UNDER THE LOCK,
   * the graph already has lessons — so a concurrent capture is never erased.
   */
  readonly force?: boolean;
  /**
   * MERGE legacy lessons INTO an existing graph instead of replacing it. This is
   * the recovery path for a stranded state — legacy `index.yaml` coexisting with
   * a populated `lessons.json` (an old binary could create this). Each legacy
   * lesson is folded in via the normal capture path: rules dedup by text,
   * triggers content-address and dedup, topics union. Never overwrites graph
   * data; `force` is irrelevant in this mode.
   */
  readonly merge?: boolean;
}

/** Thrown when migration would overwrite an already-populated graph without `force`. */
export class LessonsGraphExistsError extends Error {
  readonly code = 'LESSONS_GRAPH_EXISTS';
  constructor() {
    super('importLegacyLessons: a non-empty lessons.json already exists; pass force to overwrite.');
    this.name = 'LessonsGraphExistsError';
  }
}

export interface ImportLegacyReport {
  readonly wroteGraphPath: string;
  readonly deletedPaths: string[];
  readonly topicCount: number;
  readonly lessonCount: number;
  readonly triggerCount: number;
}

/**
 * One-shot upgrade migrator: reads the legacy YAML index + per-topic
 * Markdown files, emits the new JSON graph, and (by default) removes every
 * legacy artifact so the project lands in a clean state on the new system.
 *
 * Deterministic over (input, options): the graph output and deletion list are
 * fixed. Requires the legacy `index.yaml` to exist — it is read unconditionally
 * and a missing index throws (ENOENT). Callers MUST guard with
 * `existsSync(lessonsPaths(root).index)` before invoking (see
 * `maybeAutoMigrateLessons` and the `import-md` handler); re-running on a
 * post-migration tree, where the legacy files are already gone, throws.
 */
export async function importLegacyLessons(
  projectRoot: string,
  options: ImportLegacyOptions,
): Promise<ImportLegacyReport> {
  const paths = lessonsPaths(projectRoot);
  const indexRaw = readFileSync(paths.index, 'utf8');
  const index = LegacyIndexSchema.parse(parseYaml(indexRaw));

  const topics: Record<string, Topic> = {};
  const triggersById = new Map<string, Trigger>();
  const triggerIdByKey = new Map<string, string>();
  const lessons: Record<string, Lesson> = {};
  // Per-lesson specs for the MERGE path (rule + raw trigger patterns + topic).
  const specs: AddLessonInput[] = [];
  const summaryByTopic = new Map<string, string>();

  for (const cluster of index.clusters) {
    topics[cluster.topic] = { summary: cluster.summary };
    summaryByTopic.set(cluster.topic, cluster.summary);
    const clusterTriggerIds = collectClusterTriggerIds(cluster, triggersById, triggerIdByKey);

    const topicFile = join(projectRoot, cluster.file);
    if (!existsSync(topicFile)) {
      // Fail closed: a declared topic file that is missing means we would
      // migrate an incomplete graph and then delete the legacy source. Refuse
      // before anything is written or deleted.
      throw new Error(
        `importLegacyLessons: declared topic file is missing: ${cluster.file}. Refusing to migrate (legacy artifacts left intact).`,
      );
    }
    const topicMarkdown = readFileSync(topicFile, 'utf8');

    for (const { index: ruleIndex, body, evidence } of parseRulesSection(topicMarkdown)) {
      const lessonEvidence = [
        `legacy:${cluster.file}#rule-${ruleIndex}`,
        ...evidence.map((e) => `legacy:${e}`),
      ];
      lessons[`${cluster.topic}-rule-${ruleIndex}`] = {
        rule: body,
        topics: [cluster.topic],
        triggers: clusterTriggerIds,
        evidence: lessonEvidence,
        status: 'active',
        createdAt: options.migratedAt,
      };
      specs.push({
        rule: body,
        topic: cluster.topic,
        triggers: {
          files: cluster.triggers.file_globs,
          commands: cluster.triggers.command_patterns,
          keywords: cluster.triggers.keywords,
        },
        evidence: lessonEvidence,
        createdAt: options.migratedAt,
      });
    }
  }

  if (options.merge === true)
    return mergeLegacy(projectRoot, paths, specs, summaryByTopic, options);

  const triggers = Object.fromEntries(triggersById.entries());

  // Write through the transactional path: lock → load → replace → VALIDATE →
  // atomic save. mutate throws on any error-level finding (e.g. two identical
  // legacy rules → DUPLICATE_RULE), so an invalid migration never persists and
  // the legacy source below is left intact (fail closed).
  await mutateLessonsGraphLocked(projectRoot, (g) => {
    // Re-check existence UNDER the lock (the absent-graph check in callers is
    // racy on its own): if a concurrent writer populated the graph, refuse to
    // clobber it unless force is set. "Populated" means ANY content — a graph
    // with hand-curated topics/triggers but zero lessons must not be silently
    // replaced either.
    const populated =
      Object.keys(g.lessons).length > 0 ||
      Object.keys(g.topics).length > 0 ||
      Object.keys(g.triggers).length > 0;
    if (options.force !== true && populated) {
      throw new LessonsGraphExistsError();
    }
    g.version = 1;
    g.lessons = lessons;
    g.topics = topics;
    g.triggers = triggers;
  });

  const deletedPaths = options.deleteLegacy === false ? [] : deleteLegacyArtifacts(paths.base);

  return {
    wroteGraphPath: paths.graph,
    deletedPaths,
    topicCount: Object.keys(topics).length,
    lessonCount: Object.keys(lessons).length,
    triggerCount: triggersById.size,
  };
}
