import { maybeAutoMigrateLessons } from './auto-migrate.js';
import { loadLessonsGraphResilient } from './graph-store.js';
import { collectAlwaysLessons } from './query.js';
import { estTokens } from './ranking.js';
import { commitSeen, filterUnseen, openSessionDedup } from './seen-cache.js';

/**
 * Always-on lesson recall.
 *
 * `scope: 'always'` lessons are universal standards delivered on EVERY task, not
 * matched by triggers — so unlike {@link recallLessons} there is no query. This
 * returns the active always-lessons, newest-first, bounded by a token budget so
 * the always-set stays a lean, standing context cost. The `UserPromptSubmit` hook
 * unions these into its injection; `lessons query --always` / `lessons_query`
 * (scope) return them for targets that pull recall via CLI/MCP.
 */

/** Default cumulative rule-token budget for the always-on set. */
export const DEFAULT_ALWAYS_MAX_TOKENS = 600;

export interface AlwaysLesson {
  readonly id: string;
  readonly rule: string;
}

export interface AlwaysRecallResult {
  /** Always-on lessons within budget, newest-first. */
  readonly lessons: AlwaysLesson[];
  /** Total active always-lessons before the token cap (so callers can note drops). */
  readonly total: number;
}

export async function recallAlwaysLessons(
  projectRoot: string,
  options: { readonly maxTokens?: number | null; readonly sessionId?: string } = {},
): Promise<AlwaysRecallResult> {
  // Mirror recallLessons: migrate if needed, and never throw on a blocking path.
  try {
    await maybeAutoMigrateLessons(projectRoot);
  } catch {
    // Degrade to whatever graph state exists.
  }
  const load = loadLessonsGraphResilient(projectRoot);
  if (load.status !== 'ok') return { lessons: [], total: 0 };

  const all = collectAlwaysLessons(load.graph);
  const total = all.length;
  // Per-session dedup (same as keyword recall): an always-lesson is injected at
  // most once per session, so re-prompting does not re-inject the whole set.
  const dedup = openSessionDedup({ explicit: options.sessionId, projectRoot });
  const fresh = dedup === null ? all : filterUnseen(dedup, all);
  const budget =
    options.maxTokens === null ? undefined : (options.maxTokens ?? DEFAULT_ALWAYS_MAX_TOKENS);

  const lessons: AlwaysLesson[] = [];
  let used = 0;
  for (const { id, lesson } of fresh) {
    const cost = estTokens(lesson.rule);
    // Always keep the first; then fill while the cumulative token cost fits.
    if (budget !== undefined && lessons.length > 0 && used + cost > budget) break;
    used += cost;
    lessons.push({ id, rule: lesson.rule });
  }
  if (dedup !== null)
    commitSeen(
      dedup,
      lessons.map((l) => l.id),
    );
  return { lessons, total };
}
