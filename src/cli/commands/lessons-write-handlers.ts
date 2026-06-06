import { existsSync } from 'node:fs';
import { addLesson, UnknownTopicError } from '../../lessons/add.js';
import { graphFilePath } from '../../lessons/graph-store.js';
import { importLegacyLessons } from '../../lessons/import-legacy.js';
import { lessonsPaths } from '../../lessons/paths.js';
import { mergeLessons } from '../../lessons/merge.js';
import { mutateLessonsGraph } from '../../lessons/mutate.js';
import { stripMarkersInGraph } from '../../lessons/strip-markers.js';
import {
  errorResult,
  listFlag,
  repeatedFlag,
  stringFlag,
  todayIso,
  type LessonsFlags,
} from './lessons-helpers.js';
import type {
  LessonsAddData,
  LessonsCommandResult,
  LessonsImportMdData,
  LessonsMergeData,
  LessonsStripMarkersData,
} from './lessons-types.js';

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function doAdd(
  flags: LessonsFlags,
  positionalRule: string | undefined,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  // The BLOCKING ritual in CLAUDE.md / README documents `add "<rule>" --topic`,
  // so accept the rule positionally; an explicit --rule flag takes precedence.
  const positional =
    positionalRule !== undefined && positionalRule.length > 0 ? positionalRule : null;
  const rule = stringFlag(flags, 'rule') ?? positional;
  const topic = stringFlag(flags, 'topic');
  if (rule === null) {
    return errorResult(
      'add',
      'Missing rule — pass it positionally (`add "<rule>"`) or via --rule.',
      2,
    );
  }
  if (topic === null) return errorResult('add', 'Missing --topic', 2);

  try {
    const result = await addLesson(
      projectRoot,
      {
        rule,
        topic,
        triggers: {
          files: repeatedFlag(flags, 'trigger-file'),
          commands: repeatedFlag(flags, 'trigger-cmd'),
          keywords: repeatedFlag(flags, 'trigger-kw'),
        },
        evidence: listFlag(flags, 'evidence'),
        rationale: stringFlag(flags, 'rationale') ?? undefined,
      },
      {
        allowNewTopic: flags['new-topic'] === true,
        topicSummary: stringFlag(flags, 'topic-summary') ?? undefined,
      },
    );
    const data: LessonsAddData = result;
    return { subcommand: 'add', exitCode: 0, data };
  } catch (err) {
    if (err instanceof UnknownTopicError) {
      return errorResult(
        'add',
        `Unknown topic: ${err.topic}. Pass --new-topic --topic-summary "..." to create it.`,
        1,
      );
    }
    return errorResult('add', errMessage(err), 1);
  }
}

export async function doDeprecate(
  flags: LessonsFlags,
  lessonId: string | undefined,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  if (lessonId === undefined || lessonId === '') {
    return errorResult(
      'deprecate',
      'Usage: agentsmesh lessons deprecate <id> [--superseded-by <id>]',
      2,
    );
  }
  const supersededBy = stringFlag(flags, 'superseded-by');
  try {
    const data = await mutateLessonsGraph(projectRoot, (graph) => {
      const target = graph.lessons[lessonId];
      if (target === undefined) throw new Error(`Unknown lesson: ${lessonId}`);
      if (supersededBy !== null && graph.lessons[supersededBy] === undefined) {
        throw new Error(`Unknown superseder: ${supersededBy}`);
      }
      graph.lessons[lessonId] = {
        ...target,
        status: supersededBy === null ? 'deprecated' : 'superseded',
        ...(supersededBy === null ? {} : { supersededBy }),
      };
      return { id: lessonId, supersededBy };
    });
    return { subcommand: 'deprecate', exitCode: 0, data };
  } catch (err) {
    return errorResult('deprecate', errMessage(err), 1);
  }
}

export async function doMerge(
  loserId: string | undefined,
  keeperId: string | undefined,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  if (loserId === undefined || loserId === '' || keeperId === undefined || keeperId === '') {
    return errorResult('merge', 'Usage: agentsmesh lessons merge <loser-id> <keeper-id>', 2);
  }
  try {
    const result = await mergeLessons(projectRoot, loserId, keeperId);
    const data: LessonsMergeData = result;
    return { subcommand: 'merge', exitCode: 0, data };
  } catch (err) {
    // Strip the internal function-name prefix so the agent sees a clean message.
    const message = errMessage(err).replace(/^mergeLessons:\s*/, '');
    return errorResult('merge', message, 1);
  }
}

export async function doStripMarkers(
  flags: LessonsFlags,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const dryRun = flags['dry-run'] === true;
  const report = await stripMarkersInGraph(projectRoot, { dryRun });
  const data: LessonsStripMarkersData = {
    changedIds: report.changedIds,
    changedCount: report.changedCount,
    dryRun,
  };
  return { subcommand: 'strip-markers', exitCode: 0, data };
}

export async function doImportMd(
  flags: LessonsFlags,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const force = flags.force === true;
  const merge = flags.merge === true;
  if (!force && !merge && existsSync(graphFilePath(projectRoot))) {
    return errorResult(
      'import-md',
      'lessons.json already exists. Pass --merge to fold legacy lessons into it (recommended — recovers stranded lessons without data loss), or --force to overwrite.',
      1,
    );
  }
  // Guard the legacy read: importLegacyLessons reads index.yaml unconditionally
  // and throws a raw ENOENT when it is absent. Fail with a clean message instead.
  if (!existsSync(lessonsPaths(projectRoot).index)) {
    return errorResult(
      'import-md',
      'No legacy lessons store found (.agentsmesh/lessons/index.yaml) — nothing to migrate.',
      1,
    );
  }
  const migratedAt = stringFlag(flags, 'migrated-at') ?? todayIso();
  const report = await importLegacyLessons(projectRoot, { migratedAt, force, merge });
  const data: LessonsImportMdData = {
    topicCount: report.topicCount,
    lessonCount: report.lessonCount,
    triggerCount: report.triggerCount,
    wroteGraphPath: report.wroteGraphPath,
    deletedPaths: report.deletedPaths,
  };
  return { subcommand: 'import-md', exitCode: 0, data };
}
