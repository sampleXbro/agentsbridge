import type { Lesson, LessonsGraph } from './graph-schema.js';
import { collectMatchedTriggerIds, type LessonsQuery, type MatchedLesson } from './query.js';

export interface RankReason {
  readonly matchedTriggers: string[];
  readonly bm25: number;
  readonly specificity: number;
}

export interface RankedLesson {
  readonly id: string;
  readonly lesson: Lesson;
  readonly score: number;
  readonly reason: RankReason;
}

export interface RankOptions {
  /** Keep at most this many results (after ranking). */
  readonly limit?: number;
  /** Keep results while their cumulative estimated rule-token cost fits. */
  readonly maxTokens?: number;
}

/** Default recall cap: a broad trigger match returns the most-relevant few, not the whole topic. */
export const DEFAULT_RECALL_LIMIT = 10;

const K1 = 1.5;
const B = 0.75;
const RRF_K = 60;
const STOP = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'and',
  'or',
  'for',
  'is',
  'on',
  'at',
  'with',
  'be',
  'as',
  'it',
  'that',
  'this',
  'its',
  'must',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function queryTerms(query: LessonsQuery): string[] {
  const parts: string[] = [];
  if (query.keyword !== undefined) parts.push(query.keyword);
  if (query.file !== undefined) parts.push(query.file);
  if (query.command !== undefined) parts.push(query.command);
  return tokenize(parts.join(' '));
}

interface Corpus {
  readonly idf: Map<string, number>;
  readonly avgdl: number;
}

function buildCorpus(graph: LessonsGraph): Corpus {
  const docs: number[] = [];
  const df = new Map<string, number>();
  let total = 0;
  let n = 0;
  for (const lesson of Object.values(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    const toks = tokenize(lesson.rule);
    n += 1;
    total += toks.length;
    docs.push(toks.length);
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  // rankLessons short-circuits on empty matches, so the corpus always has >= 1
  // active lesson when we get here; N is therefore >= 1.
  const N = Math.max(n, 1);
  const idf = new Map<string, number>();
  for (const [t, f] of df) idf.set(t, Math.log(1 + (N - f + 0.5) / (f + 0.5)));
  return { idf, avgdl: total / N || 1 };
}

function bm25(terms: readonly string[], ruleText: string, corpus: Corpus): number {
  const toks = tokenize(ruleText);
  const dl = toks.length || 1;
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  let score = 0;
  for (const t of new Set(terms)) {
    const f = tf.get(t) ?? 0;
    if (f === 0) continue;
    // f > 0 ⇒ the term is in this active lesson's rule ⇒ it is in the corpus idf.
    const idf = corpus.idf.get(t)!;
    score += (idf * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * dl) / corpus.avgdl));
  }
  return score;
}

/** Active-lesson reference count per trigger — the fanout used for specificity. */
function buildFanout(graph: LessonsGraph): Map<string, number> {
  const fanout = new Map<string, number>();
  for (const lesson of Object.values(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    for (const t of lesson.triggers) fanout.set(t, (fanout.get(t) ?? 0) + 1);
  }
  return fanout;
}

/**
 * Competition ranking (1,1,3,…): equal values share a rank so a signal that
 * cannot distinguish two lessons contributes equally to both — otherwise an
 * arbitrary id tie-break in one signal would silently cancel a real lead in the
 * other under RRF.
 */
function rankMap(items: { id: string; value: number }[]): Map<string, number> {
  const sorted = [...items].sort((a, b) =>
    b.value !== a.value ? b.value - a.value : a.id < b.id ? -1 : 1,
  );
  const ranks = new Map<string, number>();
  let prevValue: number | null = null;
  let prevRank = 0;
  sorted.forEach((item, i) => {
    const rank = prevValue !== null && item.value === prevValue ? prevRank : i + 1;
    ranks.set(item.id, rank);
    prevValue = item.value;
    prevRank = rank;
  });
  return ranks;
}

function estTokens(rule: string): number {
  return Math.ceil(rule.length / 4);
}

/**
 * Rank matched lessons by relevance and apply optional caps. Two lightweight
 * signals are reciprocal-rank-fused (RRF): BM25 over the rule text (so the
 * lesson whose wording best fits the query wins even when many share a trigger)
 * and trigger specificity (inverse fanout — a discriminating trigger beats a
 * topic-wide one). Ties break by recency (createdAt) then id. No embeddings, no
 * I/O — pure and sub-millisecond.
 */
export function rankLessons(
  graph: LessonsGraph,
  query: LessonsQuery,
  matches: readonly MatchedLesson[],
  options: RankOptions = {},
): RankedLesson[] {
  if (matches.length === 0) return [];

  const terms = queryTerms(query);
  const corpus = buildCorpus(graph);
  const fanout = buildFanout(graph);
  const matchedTriggerIds = collectMatchedTriggerIds(graph, query);

  const scored = matches.map(({ id, lesson }) => {
    const hitTriggers = lesson.triggers.filter((t) => matchedTriggerIds.has(t));
    let specificity = 0;
    // Each hit trigger belongs to this active, matched lesson, so fanout has it.
    for (const t of hitTriggers) specificity = Math.max(specificity, 1 / fanout.get(t)!);
    return {
      id,
      lesson,
      bm25: bm25(terms, lesson.rule, corpus),
      specificity,
      matchedTriggers: hitTriggers,
    };
  });

  const bm25Ranks = rankMap(scored.map((s) => ({ id: s.id, value: s.bm25 })));
  const specRanks = rankMap(scored.map((s) => ({ id: s.id, value: s.specificity })));

  const ranked: RankedLesson[] = scored
    .map((s) => ({
      id: s.id,
      lesson: s.lesson,
      score: 1 / (RRF_K + bm25Ranks.get(s.id)!) + 1 / (RRF_K + specRanks.get(s.id)!),
      reason: { matchedTriggers: s.matchedTriggers, bm25: s.bm25, specificity: s.specificity },
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ca = a.lesson.createdAt;
      const cb = b.lesson.createdAt;
      if (ca !== cb) return ca < cb ? 1 : -1; // newer first
      return a.id < b.id ? -1 : 1;
    });

  return applyCaps(ranked, options);
}

function applyCaps(ranked: RankedLesson[], options: RankOptions): RankedLesson[] {
  let out = ranked;
  if (options.limit !== undefined && options.limit >= 0) out = out.slice(0, options.limit);
  if (options.maxTokens !== undefined && out.length > 0) {
    const budgeted: RankedLesson[] = [out[0]!]; // always keep the top result
    let used = estTokens(out[0]!.lesson.rule);
    for (const row of out.slice(1)) {
      const cost = estTokens(row.lesson.rule);
      if (used + cost > options.maxTokens) break;
      used += cost;
      budgeted.push(row);
    }
    out = budgeted;
  }
  return out;
}
