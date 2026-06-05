import { existsSync } from 'node:fs';
import { addLesson, UnknownTopicError } from '../../lessons/add.js';
import { graphFilePath, saveLessonsGraph, tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { importLegacyLessons } from '../../lessons/import-legacy.js';
import { queryLessons } from '../../lessons/query.js';
import { validateLessonsGraph } from '../../lessons/validate.js';
import {
  emptyGraph,
  errorResult,
  listFlag,
  parseFormat,
  queryFromFlags,
  renderTopicMarkdown,
  stringFlag,
  todayIso,
  type LessonsFlags,
} from './lessons-helpers.js';
import type {
  LessonsAddData,
  LessonsCommandResult,
  LessonsImportMdData,
  LessonsJournalData,
  LessonsQueryData,
  LessonsShowData,
  LessonsValidateData,
} from './lessons-types.js';

export type { LessonsFlags } from './lessons-helpers.js';

export function doQuery(
  flags: LessonsFlags,
  projectRoot: string,
  autoMigrated: boolean,
): LessonsCommandResult {
  const graph = tryLoadLessonsGraph(projectRoot);
  const format = parseFormat(flags);
  const query = queryFromFlags(flags);
  if (graph === null) {
    const data: LessonsQueryData = { lessons: [], query, autoMigrated };
    return { subcommand: 'query', exitCode: 0, format, data };
  }
  const matches = queryLessons(graph, query);
  const lessons = matches.map(({ id, lesson }) => ({
    id,
    rule: lesson.rule,
    topics: [...lesson.topics],
    triggers: [...lesson.triggers],
    evidence: [...lesson.evidence],
  }));
  const data: LessonsQueryData = { lessons, query, autoMigrated };
  return { subcommand: 'query', exitCode: 0, format, data };
}

export async function doAdd(
  flags: LessonsFlags,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const rule = stringFlag(flags, 'rule');
  const topic = stringFlag(flags, 'topic');
  if (rule === null) return errorResult('add', 'Missing --rule', 2);
  if (topic === null) return errorResult('add', 'Missing --topic', 2);

  try {
    const result = await addLesson(
      projectRoot,
      {
        rule,
        topic,
        triggers: {
          files: listFlag(flags, 'trigger-file'),
          commands: listFlag(flags, 'trigger-cmd'),
          keywords: listFlag(flags, 'trigger-kw'),
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
    return errorResult('add', err instanceof Error ? err.message : String(err), 1);
  }
}

export function doTopics(projectRoot: string): LessonsCommandResult {
  const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  const topics = Object.entries(graph.topics)
    .map(([id, t]) => ({ id, summary: t.summary }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return { subcommand: 'topics', exitCode: 0, data: { topics } };
}

export function doShow(topicArg: string | undefined, projectRoot: string): LessonsCommandResult {
  if (topicArg === undefined || topicArg === '') {
    return errorResult('show', 'Usage: agentsmesh lessons show <topic>', 2);
  }
  const graph = tryLoadLessonsGraph(projectRoot);
  if (graph === null || graph.topics[topicArg] === undefined) {
    return errorResult('show', `Unknown topic: ${topicArg}`, 1);
  }
  const lessons = Object.entries(graph.lessons)
    .filter(([, l]) => l.topics.includes(topicArg) && l.status === 'active')
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const markdown = renderTopicMarkdown(topicArg, graph.topics[topicArg].summary, lessons);
  const data: LessonsShowData = { topic: topicArg, markdown };
  return { subcommand: 'show', exitCode: 0, data };
}

export function doDeprecate(
  flags: LessonsFlags,
  lessonId: string | undefined,
  projectRoot: string,
): LessonsCommandResult {
  if (lessonId === undefined || lessonId === '') {
    return errorResult(
      'deprecate',
      'Usage: agentsmesh lessons deprecate <id> [--superseded-by <id>]',
      2,
    );
  }
  const graph = tryLoadLessonsGraph(projectRoot);
  if (graph === null || graph.lessons[lessonId] === undefined) {
    return errorResult('deprecate', `Unknown lesson: ${lessonId}`, 1);
  }
  const supersededBy = stringFlag(flags, 'superseded-by');
  if (supersededBy !== null && graph.lessons[supersededBy] === undefined) {
    return errorResult('deprecate', `Unknown superseder: ${supersededBy}`, 1);
  }
  graph.lessons[lessonId] = {
    ...graph.lessons[lessonId],
    status: supersededBy === null ? 'deprecated' : 'superseded',
    ...(supersededBy === null ? {} : { supersededBy }),
  };
  saveLessonsGraph(projectRoot, graph);
  return {
    subcommand: 'deprecate',
    exitCode: 0,
    data: { id: lessonId, supersededBy },
  };
}

export function doJournal(projectRoot: string): LessonsCommandResult {
  const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  const entries = Object.entries(graph.lessons)
    .map(([id, l]) => ({ id, rule: l.rule, createdAt: l.createdAt, topics: [...l.topics] }))
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  const data: LessonsJournalData = { entries };
  return { subcommand: 'journal', exitCode: 0, data };
}

export function doValidate(projectRoot: string): LessonsCommandResult {
  const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  const report = validateLessonsGraph(graph);
  const data: LessonsValidateData = { ok: report.ok, findings: report.findings };
  return { subcommand: 'validate', exitCode: report.ok ? 0 : 1, data };
}

export function doImportMd(flags: LessonsFlags, projectRoot: string): LessonsCommandResult {
  const force = flags.force === true;
  if (!force && existsSync(graphFilePath(projectRoot))) {
    return errorResult('import-md', 'lessons.json already exists. Pass --force to overwrite.', 1);
  }
  const migratedAt = stringFlag(flags, 'migrated-at') ?? todayIso();
  const report = importLegacyLessons(projectRoot, { migratedAt });
  const data: LessonsImportMdData = {
    topicCount: report.topicCount,
    lessonCount: report.lessonCount,
    triggerCount: report.triggerCount,
    wroteGraphPath: report.wroteGraphPath,
    deletedPaths: report.deletedPaths,
  };
  return { subcommand: 'import-md', exitCode: 0, data };
}
