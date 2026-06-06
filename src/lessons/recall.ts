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
