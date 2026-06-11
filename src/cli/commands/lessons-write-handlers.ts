import { existsSync } from 'node:fs';
import { NoTriggerError, UnknownTopicError, UnrecallableLessonError } from '../../lessons/add.js';
import { captureLesson } from '../../lessons/recall.js';
import { deprecateLesson } from '../../lessons/deprecate.js';
import { graphFilePath } from '../../lessons/graph-store.js';
import { importLegacyLessons } from '../../lessons/import-legacy.js';
import { lessonsPaths } from '../../lessons/paths.js';
import { mergeLessons } from '../../lessons/merge.js';
import { mutateLessonsGraph } from '../../lessons/mutate.js';
import { stripMarkersInGraph } from '../../lessons/strip-markers.js';
import { untriggerLesson } from '../../lessons/untrigger.js';
import {
  errorResult,
  listFlag,
  repeatedFlag,
  stringFlag,
  todayIso,
  type LessonsFlags,
} from './lessons-helpers.js';
import { lessonsAddHint } from './lessons-usage.js';
import type {
  LessonsAddData,
  LessonsCommandResult,
  LessonsImportMdData,
  LessonsMergeData,
  LessonsStripMarkersData,
  LessonsUntriggerData,
} from './lessons-types.js';

function errMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip internal function-name prefixes (the transactional write path tags its
  // errors) so the agent sees a clean, actionable message.
  return raw.replace(/^(mutateLessonsGraph|mergeLessons):\s*/, '');
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
      `Missing rule — pass it positionally (\`add "<rule>"\`) or via --rule.${lessonsAddHint()}`,
      2,
    );
  }
  if (topic === null) {
    return errorResult(
      'add',
      `Missing --topic — every lesson needs a topic id (run \`agentsmesh lessons topics\` to list them, or pass --new-topic --topic-summary "..." for a new area).${lessonsAddHint()}`,
      2,
    );
  }

  try {
    // Route through captureLesson (not addLesson directly) so capture telemetry
    // records EVERY shell-driven add — the MCP path already routes here, and a
    // direct addLesson call would leave CLI captures invisible to `lessons stats`.
    const result = await captureLesson(
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
    if (err instanceof NoTriggerError || err instanceof UnrecallableLessonError) {
      return errorResult('add', `${err.message}${lessonsAddHint()}`, 2);
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
    const { id, supersededBy: by } = await deprecateLesson(projectRoot, lessonId, supersededBy);
    return { subcommand: 'deprecate', exitCode: 0, data: { id, supersededBy: by } };
  } catch (err) {
    const message = errMessage(err);
    // Point an unknown-id miss at the listing commands instead of dead-ending.
    const hint = message.startsWith('Unknown lesson')
      ? ' Run `agentsmesh lessons journal` to list lesson ids (or `lessons query --ids` to see what recalled).'
      : '';
    return errorResult('deprecate', `${message}${hint}`, 1);
  }
}

export async function doUntrigger(
  lessonId: string | undefined,
  triggerId: string | undefined,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  if (lessonId === undefined || lessonId === '' || triggerId === undefined || triggerId === '') {
    return errorResult(
      'untrigger',
      'Usage: agentsmesh lessons untrigger <lesson-id> <trigger-id>',
      2,
    );
  }
  try {
    const result = await mutateLessonsGraph(projectRoot, (graph) =>
      untriggerLesson(graph, lessonId, triggerId),
    );
    const data: LessonsUntriggerData = result;
    return { subcommand: 'untrigger', exitCode: 0, data };
  } catch (err) {
    return errorResult('untrigger', errMessage(err), 1);
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
    return errorResult('merge', errMessage(err), 1);
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
