import { loadLessonsGraphResilient, tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { normalizeRecallFile } from '../../lessons/normalize-query-file.js';
import { queryLessons } from '../../lessons/query.js';
import {
  DEFAULT_RECALL_LIMIT,
  DEFAULT_RECALL_MAX_TOKENS,
  rankLessons,
} from '../../lessons/ranking.js';
import { recordRecallTelemetry } from '../../lessons/recall.js';
import { summarizeRecall } from '../../lessons/stats.js';
import { isTelemetryEnabled, readRecallLog, recallLogExists } from '../../lessons/telemetry.js';
import { validateLessonsGraph } from '../../lessons/validate.js';
import {
  emptyGraph,
  errorResult,
  numberFlag,
  parseFormat,
  queryFromFlags,
  renderTopicMarkdown,
  type LessonsFlags,
} from './lessons-helpers.js';
import type {
  LessonsCommandResult,
  LessonsJournalData,
  LessonsQueryData,
  LessonsShowData,
  LessonsValidateData,
} from './lessons-types.js';

export type { LessonsFlags } from './lessons-helpers.js';
// Write-side handlers live in a sibling module to keep each file focused.
export {
  doAdd,
  doDeprecate,
  doImportMd,
  doMerge,
  doStripMarkers,
} from './lessons-write-handlers.js';
export { doPrune } from './lessons-prune-handler.js';

/** Returns an error message if the flag is present but not a positive integer, else null. */
function validatePositiveIntFlag(flags: LessonsFlags, name: string): string | null {
  const v = flags[name];
  if (v === undefined || v === false) return null;
  const n = typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1) return `Invalid --${name}: expected a positive integer.`;
  return null;
}

/** Returns an error message if --format is present with a value outside plain|md|json, else null. */
function validateFormatFlag(flags: LessonsFlags): string | null {
  const v = flags.format;
  if (v === undefined) return null;
  if (v === 'plain' || v === 'md' || v === 'json') return null;
  return 'Invalid --format: expected plain|md|json.';
}

export function doQuery(
  flags: LessonsFlags,
  projectRoot: string,
  autoMigrated: boolean,
): LessonsCommandResult {
  const topErr = validatePositiveIntFlag(flags, 'top');
  if (topErr !== null) return errorResult('query', topErr, 2);
  const maxTokErr = validatePositiveIntFlag(flags, 'max-tokens');
  if (maxTokErr !== null) return errorResult('query', maxTokErr, 2);
  const fmtErr = validateFormatFlag(flags);
  if (fmtErr !== null) return errorResult('query', fmtErr, 2);

  const format = parseFormat(flags);
  const raw = queryFromFlags(flags);
  // Normalize the file path so a project-relative glob matches regardless of the
  // shape the caller passed (absolute / ./-prefixed / backslash).
  const query =
    raw.file === undefined ? raw : { ...raw, file: normalizeRecallFile(raw.file, projectRoot) };
  const load = loadLessonsGraphResilient(projectRoot);
  if (load.status === 'corrupt') {
    // Recall is a blocking requirement before every edit/command — a corrupt
    // graph must degrade to empty (exit 0), with a warning, not a stack trace.
    const data: LessonsQueryData = {
      lessons: [],
      query,
      autoMigrated,
      totalMatches: 0,
      warning: `lessons.json is unreadable (corrupt) — recall returned no lessons. Run \`agentsmesh lessons validate\`. (${load.error.message})`,
    };
    return { subcommand: 'query', exitCode: 0, format, data };
  }
  if (load.status === 'absent') {
    const data: LessonsQueryData = { lessons: [], query, autoMigrated, totalMatches: 0 };
    return { subcommand: 'query', exitCode: 0, format, data };
  }
  const graph = load.graph;
  const matches = queryLessons(graph, query);
  // `--all` bypasses both caps; otherwise apply the default limit + token budget
  // so mandatory recall stays lean unless the caller overrides via --top/--max-tokens.
  const limit = flags.all === true ? undefined : (numberFlag(flags, 'top') ?? DEFAULT_RECALL_LIMIT);
  const maxTokens =
    flags.all === true ? undefined : (numberFlag(flags, 'max-tokens') ?? DEFAULT_RECALL_MAX_TOKENS);
  const ranked = rankLessons(graph, query, matches, { limit, maxTokens });
  // Record recall telemetry on the CLI path too (gated; no-op unless opt-in),
  // so shell-driven `lessons query` is visible to `lessons stats` — parity with
  // the MCP `lessons_query` tool, which records via recallLessons.
  recordRecallTelemetry(projectRoot, graph, query, matches, ranked);
  const lessons = ranked.map(({ id, lesson, score }) => ({
    id,
    rule: lesson.rule,
    topics: [...lesson.topics],
    triggers: [...lesson.triggers],
    evidence: [...lesson.evidence],
    score,
  }));
  const data: LessonsQueryData = { lessons, query, autoMigrated, totalMatches: matches.length };
  return { subcommand: 'query', exitCode: 0, format, data };
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
  const report = validateLessonsGraph(graph);
  const data: LessonsValidateData = { ok: report.ok, findings: report.findings };
  return { subcommand: 'validate', exitCode: report.ok ? 0 : 1, data };
}
