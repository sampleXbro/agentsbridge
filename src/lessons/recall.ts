import {
  addLesson,
  type AddLessonInput,
  type AddLessonOptions,
  type AddLessonResult,
} from './add.js';
import { maybeAutoMigrateLessons } from './auto-migrate.js';
import type { LessonsGraph } from './graph-schema.js';
import { loadLessonsGraphResilient } from './graph-store.js';
import { normalizeRecallFile } from './normalize-query-file.js';
import {
  collectMatchedTriggersByKind,
  queryLessons,
  type LessonsQuery,
  type MatchedLesson,
} from './query.js';
import {
  estTokens,
  rankLessons,
  type RankedLesson,
} from './ranking.js';
import { loadRecallConfig } from './recall-config.js';
import { appendRecallRecord, isTelemetryEnabled } from './telemetry.js';

/**
 * Migration-aware application APIs for the lessons subsystem.
 *
 * The WRITE path migrates automatically: `mutateLessonsGraph` (and everything
 * built on it — `addLesson`, `mergeLessons`, deprecate, strip-markers) runs the
 * legacy→JSON migration before mutating, so even a first raw write can never
 * create an empty `lessons.json` over an unmigrated `index.yaml`. (The migrator
 * and scaffolding use the internal `mutateLessonsGraphLocked` to avoid
 * recursing.)
 *
 * The low-level READ primitives (`tryLoadLessonsGraph`, `loadLessonsGraph`,
 * `queryLessons`) do NOT migrate — a first read through them on a legacy project
 * would see no graph. `recallLessons` closes that: it migrates first, then
 * loads + ranks. `captureLesson` is the symmetric capture entry point. Prefer
 * these application APIs; reach for the read primitives only post-migration.
 */

export interface RecallOptions {
  /** Max ranked lessons to return. Defaults to {@link DEFAULT_RECALL_LIMIT}. */
  readonly limit?: number;
  /**
   * Cumulative rule-token budget. Defaults to {@link DEFAULT_RECALL_MAX_TOKENS};
   * pass `null` to disable the budget (return up to `limit` results).
   */
  readonly maxTokens?: number | null;
}

export interface RecallResult {
  /** Relevance-ranked, capped lessons (compact metadata lives on each entry). */
  readonly lessons: RankedLesson[];
  /** How many active lessons matched the query before the caps were applied. */
  readonly totalMatches: number;
  /**
   * True when the canonical graph existed but could not be read (corrupt JSON /
   * schema drift). Recall degrades to empty instead of throwing; callers surface
   * this so a corrupt graph is a visible warning, not silent zero recall.
   */
  readonly corrupt?: boolean;
  /**
   * Set to the on-disk schema version when the graph is newer than this build
   * understands. Recall degrades to empty (like `corrupt`) but callers surface
   * an upgrade hint rather than a "corrupt" warning.
   */
  readonly newerVersion?: number;
}

/**
 * Recall primitive for applications: migrate if needed, then return the active
 * lessons matching `query`, relevance-ranked and capped by limit + token budget.
 */
export async function recallLessons(
  projectRoot: string,
  query: LessonsQuery,
  options: RecallOptions = {},
): Promise<RecallResult> {
  await maybeAutoMigrateLessons(projectRoot);
  const load = loadLessonsGraphResilient(projectRoot);
  if (load.status === 'corrupt') return { lessons: [], totalMatches: 0, corrupt: true };
  if (load.status === 'newer-version') {
    return { lessons: [], totalMatches: 0, newerVersion: load.version };
  }
  if (load.status === 'absent') return { lessons: [], totalMatches: 0 };
  const graph = load.graph;
  // Normalize the file path so a project-relative glob matches regardless of the
  // shape the caller passed (absolute / ./-prefixed / backslash).
  const matchQuery: LessonsQuery =
    query.file === undefined
      ? query
      : { ...query, file: normalizeRecallFile(query.file, projectRoot) };
  const matches = queryLessons(graph, matchQuery);
  // Per-project recall tuning is the fallback for unset options; explicit
  // options (and `maxTokens: null` to disable the budget) still win.
  const cfg = loadRecallConfig(projectRoot);
  const lessons = rankLessons(graph, matchQuery, matches, {
    limit: options.limit ?? cfg.limit,
    maxTokens: options.maxTokens === null ? undefined : (options.maxTokens ?? cfg.maxTokens),
  });
  recordRecallTelemetry(projectRoot, graph, matchQuery, matches, lessons);
  return { lessons, totalMatches: matches.length };
}

/**
 * Append one telemetry record for this recall — gated, so the hot path computes
 * nothing (no provenance pass, no timestamp, no I/O) in the default-off config.
 *
 * Exported so the CLI `lessons query` handler records identically to this
 * (MCP) path; both query entry points MUST share this single recorder, or
 * shell-driven recall would be invisible to `lessons stats`.
 */
export function recordRecallTelemetry(
  projectRoot: string,
  graph: LessonsGraph,
  query: LessonsQuery,
  matches: readonly MatchedLesson[],
  lessons: readonly RankedLesson[],
): void {
  if (!isTelemetryEnabled()) return;
  const byKind = collectMatchedTriggersByKind(graph, query);
  const countVia = (set: Set<string>): number =>
    matches.filter(({ lesson }) => lesson.triggers.some((t) => set.has(t))).length;
  appendRecallRecord(projectRoot, {
    ts: new Date().toISOString(),
    hasFile: query.file !== undefined,
    hasCommand: query.command !== undefined,
    hasKeyword: query.keyword !== undefined,
    totalMatches: matches.length,
    returnedCount: lessons.length,
    returnedTokens: lessons.reduce((sum, l) => sum + estTokens(l.lesson.rule), 0),
    truncated: matches.length > lessons.length,
    matchedByKind: {
      file: countVia(byKind.file_glob),
      command: countVia(byKind.command_pattern),
      keyword: countVia(byKind.keyword),
    },
  });
}

/**
 * Capture primitive for applications: migrate if needed, then add the lesson
 * through the transactional write path. Idempotent on repeat (same rule+topic).
 */
export async function captureLesson(
  projectRoot: string,
  input: AddLessonInput,
  options: AddLessonOptions = {},
): Promise<AddLessonResult> {
  await maybeAutoMigrateLessons(projectRoot);
  return addLesson(projectRoot, input, options);
}
