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
  /** Σ returned tokens across the log window — the per-action recall cost. */
  readonly cumulativeRecallTokens: number;
  /** Σ est-tokens of every active rule — the one-time session-preload cost. */
  readonly wholeActiveSetTokens: number;
  readonly preloadBreakEven: { readonly perActionCheaper: boolean; readonly ratio: number };
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

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function isKeywordOnly(graph: LessonsGraph, triggers: readonly string[]): boolean {
  return triggers.length > 0 && triggers.every((t) => graph.triggers[t]?.kind === 'keyword');
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
    preloadBreakEven: {
      perActionCheaper: cumulative < wholeSet,
      ratio: wholeSet === 0 ? 0 : cumulative / wholeSet,
    },
    reachability: {
      keywordOnlyRecallRate: matched.length === 0 ? 0 : keywordOnlyRecalls / matched.length,
      keywordOnlyUnreachableLessons: keywordOnlyUnreachable,
    },
  };
}
