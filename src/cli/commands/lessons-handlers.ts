import {
  captureLogExists,
  readCaptureLog,
} from '../../lessons/capture-telemetry.js';
import { tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { buildRecallHookOutput } from '../../lessons/hook.js';
import { listProjectFiles } from '../../lessons/project-files.js';
import { summarizeCapture } from '../../lessons/stats-capture.js';
import { summarizeRecall } from '../../lessons/stats.js';
import { isTelemetryEnabled, readRecallLog, recallLogExists } from '../../lessons/telemetry.js';
import { validateLessonsGraph } from '../../lessons/validate.js';
import {
  emptyGraph,
  errorResult,
  renderLessonMarkdown,
  renderTopicMarkdown,
  type LessonsFlags,
} from './lessons-helpers.js';
import type {
  LessonsCommandResult,
  LessonsJournalData,
  LessonsValidateData,
} from './lessons-types.js';

export type { LessonsFlags } from './lessons-helpers.js';
// Recall (read-heavy, dedup-aware) lives in its own module; re-exported so the
// dispatcher keeps importing every handler from here.
export { doQuery } from './lessons-query-handler.js';
export { doMergeDriver } from './lessons-merge-driver-handler.js';
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

export function doShow(arg: string | undefined, projectRoot: string): LessonsCommandResult {
  if (arg === undefined || arg === '') {
    return errorResult('show', 'Usage: agentsmesh lessons show <topic|lesson-id>', 2);
  }
  const graph = tryLoadLessonsGraph(projectRoot);
  if (graph !== null && graph.topics[arg] !== undefined) {
    const lessons = Object.entries(graph.lessons)
      .filter(([, l]) => l.topics.includes(arg) && l.status === 'active')
      .sort(([a], [b]) => (a < b ? -1 : 1));
    const markdown = renderTopicMarkdown(arg, graph.topics[arg].summary, lessons);
    return { subcommand: 'show', exitCode: 0, data: { subject: arg, markdown } };
  }
  // Fall back to lesson-id lookup so a recalled lesson can be inspected by id
  // (rule, status, topics, and every trigger resolved to its pattern).
  if (graph !== null && graph.lessons[arg] !== undefined) {
    const markdown = renderLessonMarkdown(arg, graph.lessons[arg], graph.triggers);
    return { subcommand: 'show', exitCode: 0, data: { subject: arg, markdown } };
  }
  return errorResult(
    'show',
    `Unknown topic or lesson id: ${arg}. Run \`agentsmesh lessons topics\` to list topics, or \`agentsmesh lessons journal\` to list lesson ids.`,
    1,
  );
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
  const captureReport = summarizeCapture(readCaptureLog(projectRoot));
  const format = flags.json === true ? 'json' : 'text';
  return {
    subcommand: 'stats',
    exitCode: 0,
    format,
    data: {
      report,
      captureReport,
      hasLog: recallLogExists(projectRoot),
      hasCaptureLog: captureLogExists(projectRoot),
      telemetryEnabled: isTelemetryEnabled(),
    },
  };
}

export function doValidate(projectRoot: string): LessonsCommandResult {
  // Recall's corrupt-graph warning routes users HERE, so validate must diagnose
  // a corrupt file as a structured finding — not dead-end on the raw parse error.
  let graph;
  try {
    graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  } catch (err) {
    const data: LessonsValidateData = {
      ok: false,
      findings: [
        {
          level: 'error',
          code: 'CORRUPT_GRAPH',
          message: `lessons.json could not be parsed (${err instanceof Error ? err.message : String(err)}). The graph is git-tracked — restore it (e.g. \`git checkout -- .agentsmesh/lessons/lessons.json\`) or repair the JSON; recall degrades to empty until then.`,
        },
      ],
    };
    return { subcommand: 'validate', exitCode: 1, data };
  }
  // Supply the working-tree file list so dead-`file_glob` triggers surface; null
  // (no git, walk failed) → undefined → the liveness check is skipped, never a
  // false "everything is dead".
  const knownPaths = listProjectFiles(projectRoot) ?? undefined;
  const report = validateLessonsGraph(graph, { knownPaths });
  const data: LessonsValidateData = { ok: report.ok, findings: report.findings };
  return { subcommand: 'validate', exitCode: report.ok ? 0 : 1, data };
}

/**
 * Hook-mode recall (internal — invoked by a generated PostToolUse hook, not by a
 * human). Reads the harness hook payload from stdin, recalls lessons for the
 * touched file/command, and emits the harness context-injection JSON on stdout.
 * Always exits 0 and stays silent on any unrecognized input, so a wired hook can
 * never break the harness.
 */
export async function doHook(projectRoot: string): Promise<LessonsCommandResult> {
  const raw = await readStdin();
  const { output } = await buildRecallHookOutput(raw, projectRoot);
  return { subcommand: 'hook', exitCode: 0, data: { output } };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
