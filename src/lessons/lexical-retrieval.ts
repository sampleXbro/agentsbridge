import type { LessonsGraph } from './graph-schema.js';
import { queryLessons, type LessonsQuery, type MatchedLesson } from './query.js';
import { bm25, buildCorpus, tokenize } from './ranking-text.js';

/**
 * Lexical retrieval: reach a lesson by the wording of its rule, not only by a
 * trigger. Trigger recall is exact and cheap, but a conceptual lesson fires only
 * when its keyword trigger happens to appear in the task text; phrased another
 * way, it is silent. Scoring the task text against every active rule with the
 * BM25 the ranker already owns closes most of that gap for zero dependencies.
 *
 * Runs ONLY for keyword-only queries — the prompt-submit hook and the task-start
 * `lessons query --keyword` — never for a file/command query, where a wording
 * match would be weaker evidence than the trigger that fired and precision is
 * what matters. Candidates carry `lexical: true`; they match no trigger, so the
 * ranker's specificity puts them below any triggered lesson.
 */

/** Most wording matches added per recall; the caps still apply after ranking. */
export const LEXICAL_LIMIT = 3;
/** Distinct query terms a rule must contain; one shared word is coincidence. */
export const LEXICAL_MIN_TERMS = 2;

/**
 * Words too generic to count toward the gate. The ranker's stoplist is tiny on
 * purpose (BM25 weighs the rest by rarity), but the gate is a yes/no: "top" and
 * "left" once qualified a merge-conflict-marker rule for an SVG prompt. BM25
 * still scores these; they just cannot be the reason a rule qualifies.
 */
const GENERIC = new Set(
  (
    'top left right bottom before after first last next new old use used using run make keep set ' +
    'get add all any each every not no never always only one two more less same other than then ' +
    'into from over under out up down off via per so if else when where which what who how why ' +
    'do does did done can could should would will may might has have had are was were been being ' +
    'also still just even very both either such these those they them their we you your our he ' +
    'she his her my me our us own same here there now then again once about above below between ' +
    'during through until while because but by need needs needed way ways thing things'
  ).split(' '),
);

export function isKeywordOnlyQuery(query: LessonsQuery): boolean {
  return query.keyword !== undefined && query.file === undefined && query.command === undefined;
}

export interface MatchResult {
  /** Trigger matches first, then wording matches (each flagged `lexical`). */
  readonly matches: MatchedLesson[];
  /** How many of `matches` came from wording, for telemetry. */
  readonly lexicalCount: number;
}

/** The one candidate step every recall entry point shares (CLI, MCP, hook). */
export function matchLessons(graph: LessonsGraph, query: LessonsQuery): MatchResult {
  const triggered = queryLessons(graph, query);
  const lexical =
    isKeywordOnlyQuery(query) && query.keyword !== undefined
      ? lexicalCandidates(
          graph,
          query.keyword,
          triggered.map((m) => m.id),
        )
      : [];
  return { matches: [...triggered, ...lexical], lexicalCount: lexical.length };
}

/**
 * Active, non-always lessons whose rule shares at least {@link LEXICAL_MIN_TERMS}
 * distinct terms with `keyword`, best BM25 first, capped at {@link LEXICAL_LIMIT}.
 * `excludeIds` are the lessons a trigger already matched.
 */
export function lexicalCandidates(
  graph: LessonsGraph,
  keyword: string,
  excludeIds: readonly string[],
): MatchedLesson[] {
  const terms = [...new Set(tokenize(keyword))];
  if (terms.length < LEXICAL_MIN_TERMS) return [];
  const excluded = new Set(excludeIds);
  const corpus = buildCorpus(graph);
  const scored: { id: string; lesson: LessonsGraph['lessons'][string]; score: number }[] = [];
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status !== 'active' || lesson.scope === 'always' || excluded.has(id)) continue;
    const ruleTerms = new Set(tokenize(lesson.rule));
    let shared = 0;
    for (const t of terms) if (!GENERIC.has(t) && ruleTerms.has(t)) shared += 1;
    if (shared < LEXICAL_MIN_TERMS) continue;
    scored.push({ id, lesson, score: bm25(terms, lesson.rule, corpus) });
  }
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id < b.id ? -1 : 1));
  return scored.slice(0, LEXICAL_LIMIT).map(({ id, lesson }) => ({ id, lesson, lexical: true }));
}
