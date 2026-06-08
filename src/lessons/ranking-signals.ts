import type { LessonsGraph } from './graph-schema.js';
import type { MatchedLesson } from './query.js';

/**
 * Ranking signals derived from graph STRUCTURE (not text — that lives in
 * ranking-text.ts). Split out of ranking.ts to keep each file within the
 * repository 200-line limit; ranking.ts owns the RRF fusion and capping.
 */

/** Active-lesson reference count per trigger — the fanout used for specificity. */
export function buildFanout(graph: LessonsGraph): Map<string, number> {
  const fanout = new Map<string, number>();
  for (const lesson of Object.values(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    for (const t of lesson.triggers) fanout.set(t, (fanout.get(t) ?? 0) + 1);
  }
  return fanout;
}

/**
 * Per-query topic coherence, keyed by lesson id. For each topic, count how many
 * lessons in THIS query's matched set reference it; a lesson's coherence is the
 * max over its own topics — "this query is mostly about topic X, and I'm in X".
 *
 * Computed over the matched set (not the whole graph) on purpose: it reflects
 * what the current query is about, so it cannot simply favour the largest topic
 * in the corpus. When several matched lessons cluster in one topic, that topic
 * is probably what the query is about, and its members are boosted together.
 */
export function buildTopicCoherence(matches: readonly MatchedLesson[]): Map<string, number> {
  const topicCount = new Map<string, number>();
  for (const { lesson } of matches) {
    for (const t of lesson.topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  }
  const coherence = new Map<string, number>();
  for (const { id, lesson } of matches) {
    let best = 0;
    // Every topic of a matched lesson was counted in the first pass, so the
    // lookup always hits — assert it (mirrors ranking.ts's fanout invariant).
    for (const t of lesson.topics) best = Math.max(best, topicCount.get(t)!);
    coherence.set(id, best);
  }
  return coherence;
}
