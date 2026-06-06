import type { LessonsGraph } from './graph-schema.js';
import type { LessonsQuery } from './query.js';

/**
 * Text/BM25 helpers for {@link rankLessons}. Split out of ranking.ts to keep
 * each file within the repository 200-line limit; this module owns tokenization
 * and the BM25 corpus, ranking.ts owns fusion and capping.
 */

const K1 = 1.5;
const B = 0.75;
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

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export function queryTerms(query: LessonsQuery): string[] {
  const parts: string[] = [];
  if (query.keyword !== undefined) parts.push(query.keyword);
  if (query.file !== undefined) parts.push(query.file);
  if (query.command !== undefined) parts.push(query.command);
  return tokenize(parts.join(' '));
}

export interface Corpus {
  readonly idf: Map<string, number>;
  readonly avgdl: number;
}

export function buildCorpus(graph: LessonsGraph): Corpus {
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

export function bm25(terms: readonly string[], ruleText: string, corpus: Corpus): number {
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
