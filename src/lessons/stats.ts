import type { LessonsGraph } from './graph-schema.js';
import { estTokens } from './ranking.js';
import type { RecallTelemetryRecord } from './telemetry.js';

/**
 * Pure aggregator over the recall telemetry log. Answers the question Item A
 * exists for: is per-action recall token-justified versus loading the whole
 * active set once per session? — plus the reachability metrics that motivate the
 * keyword-derivation work (Item B).
 */

export interface HistogramBucket {
  readonly bucket: string;
  readonly count: number;
}

export interface RecallStatsReport {
  readonly totalRecalls: number;
  /** Fraction of recalls that matched nothing (0..1). */
  readonly noMatchRate: number;
  readonly matchCountHistogram: HistogramBucket[];
  readonly returnedTokens: { readonly p50: number; readonly p90: number; readonly max: number };
  /** Σ returned tokens across the log window, INCLUDING `--all` diagnostic dumps. */
  readonly cumulativeRecallTokens: number;
  /** Σ est-tokens of every active rule — the preload cost PER session. */
  readonly wholeActiveSetTokens: number;
  /** `--all` recalls (caps off) — excluded from the mandatory break-even. */
  readonly bypassedRecalls: number;
  /**
   * Session-aware preload comparison. The prior model compared cumulative
   * multi-session recall against a SINGLE preload, which is wrong: preloading the
   * active set costs `wholeActiveSetTokens` once PER session. Here `preloadTokens`
   * multiplies by the session count, mandatory (non-`--all`) recall is the recall
   * side, and `ratio = preloadTokens / mandatoryRecallTokens` (>1 ⇒ recall cheaper).
   */
  readonly preloadBreakEven: {
    readonly sessions: number;
    readonly preloadTokens: number;
    readonly mandatoryRecallTokens: number;
    readonly recallCheaper: boolean;
    readonly ratio: number;
  };
  /**
   * Intra-session repeat-delivery — the dedup opportunity (Phase 5). `rate` is the
   * share of delivered rule-tokens that re-deliver a lesson already shown earlier
   * in the same session; `coverage` is the fraction of recalls carrying lesson ids
   * (older records lack them, so a low coverage means `rate` is under-measured).
   */
  readonly redundancy: { readonly rate: number; readonly coverage: number };
  readonly reachability: {
    /** Of matched recalls, fraction whose matches came ONLY via keyword triggers. */
    readonly keywordOnlyRecallRate: number;
    /** Active lessons whose every trigger is a keyword — invisible to file/cmd recall. */
    readonly keywordOnlyUnreachableLessons: number;
  };
}

const BUCKETS: ReadonlyArray<{ label: string; test: (n: number) => boolean }> = [
  { label: '0', test: (n) => n === 0 },
  { label: '1', test: (n) => n === 1 },
  { label: '2-3', test: (n) => n >= 2 && n <= 3 },
  { label: '4-9', test: (n) => n >= 4 && n <= 9 },
  { label: '10+', test: (n) => n >= 10 },
];

/** A run of recalls is a new session after this idle gap when ids are absent. */
const SESSION_GAP_MS = 30 * 60 * 1000;

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function isKeywordOnly(graph: LessonsGraph, triggers: readonly string[]): boolean {
  return triggers.length > 0 && triggers.every((t) => graph.triggers[t]?.kind === 'keyword');
}

/**
 * Assign each record (in log order) a 0-based session index. Explicit
 * {@link RecallTelemetryRecord.session} ids group contiguously; records lacking
 * ids start a new session once the idle gap from the previous record exceeds
 * {@link SESSION_GAP_MS}. Mirrors the manual >30-min clustering used to audit the
 * graph, so `stats` needs no env wiring to report a defensible session count.
 */
function sessionIndices(records: readonly RecallTelemetryRecord[]): number[] {
  const out: number[] = [];
  let group = 0;
  for (let i = 0; i < records.length; i++) {
    if (i === 0) {
      out.push(0);
      continue;
    }
    const cur = records[i]!;
    const prev = records[i - 1]!;
    const boundary =
      cur.session !== undefined || prev.session !== undefined
        ? cur.session !== prev.session
        : Date.parse(cur.ts) - Date.parse(prev.ts) > SESSION_GAP_MS;
    if (boundary) group++;
    out.push(group);
  }
  return out;
}

function intraSessionRedundancy(
  records: readonly RecallTelemetryRecord[],
  indices: readonly number[],
  graph: LessonsGraph,
): { rate: number; coverage: number } {
  const withIds = records.filter((r) => r.lessonIds !== undefined).length;
  const seen = new Map<number, Set<string>>();
  let redundant = 0;
  let accounted = 0;
  for (let i = 0; i < records.length; i++) {
    const ids = records[i]!.lessonIds;
    if (ids === undefined) continue;
    const g = indices[i]!;
    let s = seen.get(g);
    if (s === undefined) {
      s = new Set();
      seen.set(g, s);
    }
    for (const id of ids) {
      const tok = estTokens(graph.lessons[id]?.rule ?? '');
      accounted += tok;
      if (s.has(id)) redundant += tok;
      else s.add(id);
    }
  }
  return {
    rate: accounted === 0 ? 0 : redundant / accounted,
    coverage: records.length === 0 ? 0 : withIds / records.length,
  };
}

export function summarizeRecall(
  records: readonly RecallTelemetryRecord[],
  graph: LessonsGraph,
): RecallStatsReport {
  const total = records.length;
  const noMatch = records.filter((r) => r.totalMatches === 0).length;
  const tokens = records.map((r) => r.returnedTokens);
  const cumulative = tokens.reduce((a, b) => a + b, 0);

  const active = Object.values(graph.lessons).filter((l) => l.status === 'active');
  const wholeSet = active.reduce((a, l) => a + estTokens(l.rule), 0);

  const indices = sessionIndices(records);
  const sessions = total === 0 ? 0 : indices[indices.length - 1]! + 1;
  const bypassedRecalls = records.filter((r) => r.bypassed === true).length;
  const mandatoryRecallTokens = records
    .filter((r) => r.bypassed !== true)
    .reduce((a, r) => a + r.returnedTokens, 0);
  const preloadTokens = wholeSet * sessions;

  const matched = records.filter((r) => r.totalMatches > 0);
  const keywordOnlyRecalls = matched.filter(
    (r) =>
      r.matchedByKind.keyword > 0 && r.matchedByKind.file === 0 && r.matchedByKind.command === 0,
  ).length;
  const keywordOnlyUnreachable = active.filter((l) => isKeywordOnly(graph, l.triggers)).length;

  return {
    totalRecalls: total,
    noMatchRate: total === 0 ? 0 : noMatch / total,
    matchCountHistogram: BUCKETS.map((b) => ({
      bucket: b.label,
      count: records.filter((r) => b.test(r.totalMatches)).length,
    })),
    returnedTokens: {
      p50: percentile(tokens, 50),
      p90: percentile(tokens, 90),
      max: tokens.length === 0 ? 0 : Math.max(...tokens),
    },
    cumulativeRecallTokens: cumulative,
    wholeActiveSetTokens: wholeSet,
    bypassedRecalls,
    preloadBreakEven: {
      sessions,
      preloadTokens,
      mandatoryRecallTokens,
      recallCheaper: mandatoryRecallTokens < preloadTokens,
      ratio: mandatoryRecallTokens === 0 ? 0 : preloadTokens / mandatoryRecallTokens,
    },
    redundancy: intraSessionRedundancy(records, indices, graph),
    reachability: {
      keywordOnlyRecallRate: matched.length === 0 ? 0 : keywordOnlyRecalls / matched.length,
      keywordOnlyUnreachableLessons: keywordOnlyUnreachable,
    },
  };
}
