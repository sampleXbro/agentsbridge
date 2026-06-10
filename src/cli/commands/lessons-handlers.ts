import { tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { listProjectFiles } from '../../lessons/project-files.js';
import { summarizeRecall } from '../../lessons/stats.js';
import { isTelemetryEnabled, readRecallLog, recallLogExists } from '../../lessons/telemetry.js';
import { validateLessonsGraph } from '../../lessons/validate.js';
import { emptyGraph, errorResult, renderTopicMarkdown, type LessonsFlags } from './lessons-helpers.js';
import type {
  LessonsCommandResult,
  LessonsJournalData,
  LessonsShowData,
  LessonsValidateData,
} from './lessons-types.js';

export type { LessonsFlags } from './lessons-helpers.js';
// Recall (read-heavy, dedup-aware) lives in its own module; re-exported so the
// dispatcher keeps importing every handler from here.
export { doQuery } from './lessons-query-handler.js';
// Write-side handlers live in a sibling module to keep each file focused.
export {
  doAdd,
  doDeprecate,
  doImportMd,
  doMerge,
  doStripMarkers,
  doUntrigger,
} from './lessons-write-handlers.js';
export { doPrune } from './lessons-prune-handler.js';

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

export function doStats(flags: LessonsFlags, projectRoot: string): LessonsCommandResult {
  const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  const report = summarizeRecall(readRecallLog(projectRoot), graph);
  const format = flags.json === true ? 'json' : 'text';
  return {
    subcommand: 'stats',
    exitCode: 0,
    format,
    data: {
      report,
      hasLog: recallLogExists(projectRoot),
      telemetryEnabled: isTelemetryEnabled(),
    },
  };
}

export function doValidate(projectRoot: string): LessonsCommandResult {
  const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  // Supply the working-tree file list so dead-`file_glob` triggers surface; null
  // (no git, walk failed) → undefined → the liveness check is skipped, never a
  // false "everything is dead".
  const knownPaths = listProjectFiles(projectRoot) ?? undefined;
  const report = validateLessonsGraph(graph, { knownPaths });
  const data: LessonsValidateData = { ok: report.ok, findings: report.findings };
  return { subcommand: 'validate', exitCode: report.ok ? 0 : 1, data };
}
