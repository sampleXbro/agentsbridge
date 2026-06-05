import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Lesson, LessonsGraph, Topic, Trigger, TriggerKind } from './graph-schema.js';
import { saveLessonsGraph } from './graph-store.js';
import { lessonsPaths } from './paths.js';

export interface ImportLegacyOptions {
  /** ISO date stamped onto every imported lesson's `createdAt`. */
  readonly migratedAt: string;
  /**
   * When `true` (default), delete the legacy `index.yaml`, `journal.md`,
   * `topics/`, `distill-ledger.yaml`, and `distill-proposal.md` after a
   * successful migration. Pass `false` to leave them in place (test-only).
   */
  readonly deleteLegacy?: boolean;
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
 * Idempotent over (input, options): the graph output and the deletion list
 * are deterministic, and a second run on the post-migration tree is a no-op
 * (returns zero counts; the legacy files are already gone).
 */
export function importLegacyLessons(
  projectRoot: string,
  options: ImportLegacyOptions,
): ImportLegacyReport {
  const paths = lessonsPaths(projectRoot);
  const indexRaw = readFileSync(paths.index, 'utf8');
  const index = LegacyIndexSchema.parse(parseYaml(indexRaw));

  const topics: Record<string, Topic> = {};
  const triggersById = new Map<string, Trigger>();
  const triggerIdByKey = new Map<string, string>();
  const lessons: Record<string, Lesson> = {};

  for (const cluster of index.clusters) {
    topics[cluster.topic] = { summary: cluster.summary };
    const clusterTriggerIds = collectClusterTriggerIds(cluster, triggersById, triggerIdByKey);

    const topicFile = join(projectRoot, cluster.file);
    if (!existsSync(topicFile)) continue;
    const topicMarkdown = readFileSync(topicFile, 'utf8');

    for (const { index: ruleIndex, body, evidence } of parseRulesSection(topicMarkdown)) {
      const lessonId = `${cluster.topic}-rule-${ruleIndex}`;
      lessons[lessonId] = {
        rule: body,
        topics: [cluster.topic],
        triggers: clusterTriggerIds,
        evidence: [
          `legacy:${cluster.file}#rule-${ruleIndex}`,
          ...evidence.map((e) => `legacy:${e}`),
        ],
        status: 'active',
        createdAt: options.migratedAt,
      };
    }
  }

  const graph: LessonsGraph = {
    version: 1,
    lessons,
    topics,
    triggers: Object.fromEntries(triggersById.entries()),
  };
  saveLessonsGraph(projectRoot, graph);

  const deletedPaths = options.deleteLegacy === false ? [] : deleteLegacyArtifacts(paths.base);

  return {
    wroteGraphPath: paths.graph,
    deletedPaths,
    topicCount: Object.keys(topics).length,
    lessonCount: Object.keys(lessons).length,
    triggerCount: triggersById.size,
  };
}

const LegacyTriggersSchema = z
  .object({
    file_globs: z.array(z.string()),
    command_patterns: z.array(z.string()),
    keywords: z.array(z.string()),
  })
  .refine((t) => t.file_globs.length + t.command_patterns.length + t.keywords.length > 0, {
    message: 'cluster must declare at least one trigger of any type',
  });

const LegacyClusterSchema = z.object({
  topic: z.string().regex(/^[a-z0-9-]+$/),
  file: z.string().regex(/\.md$/),
  summary: z.string().min(1),
  triggers: LegacyTriggersSchema,
});

const LegacyIndexSchema = z.object({
  version: z.literal(1),
  clusters: z.array(LegacyClusterSchema),
});

type LegacyCluster = z.infer<typeof LegacyClusterSchema>;

interface TriggerSpec {
  readonly kind: TriggerKind;
  readonly pattern: string;
}

function collectClusterTriggerIds(
  cluster: LegacyCluster,
  triggersById: Map<string, Trigger>,
  triggerIdByKey: Map<string, string>,
): string[] {
  const specs: TriggerSpec[] = [
    ...cluster.triggers.file_globs.map((p): TriggerSpec => ({ kind: 'file_glob', pattern: p })),
    ...cluster.triggers.command_patterns.map(
      (p): TriggerSpec => ({ kind: 'command_pattern', pattern: p }),
    ),
    ...cluster.triggers.keywords.map((p): TriggerSpec => ({ kind: 'keyword', pattern: p })),
  ];

  const ids: string[] = [];
  for (const spec of specs) {
    const key = `${spec.kind}|${spec.pattern}`;
    let id = triggerIdByKey.get(key);
    if (id === undefined) {
      id = makeTriggerId(spec);
      triggerIdByKey.set(key, id);
      triggersById.set(id, { kind: spec.kind, pattern: spec.pattern });
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

const TRIGGER_PREFIX: Record<TriggerKind, string> = {
  file_glob: 'glob',
  command_pattern: 'cmd',
  keyword: 'kw',
};

function makeTriggerId(spec: TriggerSpec): string {
  const hash = createHash('sha1').update(`${spec.kind}|${spec.pattern}`).digest('hex').slice(0, 8);
  return `t-${TRIGGER_PREFIX[spec.kind]}-${hash}`;
}

interface ParsedRule {
  readonly index: number;
  readonly body: string;
  readonly evidence: string[];
}

const RULE_HEADING_RE = /^##\s+Rules\b.*$/i;
const NEXT_HEADING_RE = /^##\s+/;
const RULE_LINE_RE = /^(\d+)\.\s+(.+?)\s*$/;
const EVIDENCE_TAIL_RE = /\s*\(Evidence:?\s+([^)]+)\)\s*$/;
const EVIDENCE_REF_RE = /L\d+/g;

function parseRulesSection(markdown: string): ParsedRule[] {
  const lines = markdown.split(/\r?\n/);
  let inRules = false;
  const rules: ParsedRule[] = [];

  for (const line of lines) {
    if (!inRules) {
      if (RULE_HEADING_RE.test(line)) inRules = true;
      continue;
    }
    if (NEXT_HEADING_RE.test(line)) break;

    const m = RULE_LINE_RE.exec(line);
    if (m === null) continue;

    const ruleIndex = Number(m[1]);
    let body = m[2] ?? '';
    const evidence: string[] = [];

    let tail = EVIDENCE_TAIL_RE.exec(body);
    while (tail !== null) {
      const refs = tail[1] ?? '';
      const matches = refs.match(EVIDENCE_REF_RE);
      if (matches !== null) evidence.unshift(...matches);
      body = body.slice(0, tail.index).trimEnd();
      tail = EVIDENCE_TAIL_RE.exec(body);
    }

    rules.push({ index: ruleIndex, body, evidence });
  }

  return rules;
}

const LEGACY_ARTIFACT_REL = [
  'index.yaml',
  'journal.md',
  'journal.legacy.md',
  'topics',
  'distill-ledger.yaml',
  'distill-proposal.md',
] as const;

function deleteLegacyArtifacts(baseDir: string): string[] {
  const deleted: string[] = [];
  for (const rel of LEGACY_ARTIFACT_REL) {
    const abs = join(baseDir, rel);
    if (!existsSync(abs)) continue;
    rmSync(abs, { recursive: true, force: true });
    deleted.push(abs);
  }
  return deleted;
}
