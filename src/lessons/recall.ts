import {
  addLesson,
  type AddLessonInput,
  type AddLessonOptions,
  type AddLessonResult,
} from './add.js';
import { maybeAutoMigrateLessons } from './auto-migrate.js';
import { tryLoadLessonsGraph } from './graph-store.js';
import { queryLessons, type LessonsQuery } from './query.js';
import {
  DEFAULT_RECALL_LIMIT,
  DEFAULT_RECALL_MAX_TOKENS,
  rankLessons,
  type RankedLesson,
} from './ranking.js';

/**
 * Migration-aware application APIs for the lessons subsystem.
 *
 * The low-level primitives (`tryLoadLessonsGraph`, `mutateLessonsGraph`,
 * `addLesson`) intentionally do NOT run the legacy→JSON migration: the migrator
 * itself writes through `mutateLessonsGraph`, so embedding migration there would
 * recurse. That left a gap — a downstream consumer (or the public API) doing a
 * first read/write via the primitives would create an empty `lessons.json` and
 * permanently strand a legacy `index.yaml`.
 *
 * `recallLessons` and `captureLesson` are the blessed entry points: each runs
 * `maybeAutoMigrateLessons` first, so any caller — CLI, MCP, or third-party
 * tooling — migrates a legacy store before reading or writing. Prefer these over
 * the primitives; reach for the primitives only when you have already migrated.
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
  const graph = tryLoadLessonsGraph(projectRoot);
  if (graph === null) return { lessons: [], totalMatches: 0 };
  const matches = queryLessons(graph, query);
  const lessons = rankLessons(graph, query, matches, {
    limit: options.limit ?? DEFAULT_RECALL_LIMIT,
    maxTokens:
      options.maxTokens === null ? undefined : (options.maxTokens ?? DEFAULT_RECALL_MAX_TOKENS),
  });
  return { lessons, totalMatches: matches.length };
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
