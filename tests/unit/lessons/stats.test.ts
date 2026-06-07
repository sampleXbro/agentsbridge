import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { summarizeRecall } from '../../../src/lessons/stats.js';
import type { RecallTelemetryRecord } from '../../../src/lessons/telemetry.js';

function rec(over: Partial<RecallTelemetryRecord> = {}): RecallTelemetryRecord {
  return {
    ts: '2026-06-07T00:00:00.000Z',
    hasFile: true,
    hasCommand: false,
    hasKeyword: false,
    totalMatches: 1,
    returnedCount: 1,
    returnedTokens: 50,
    truncated: false,
    matchedByKind: { file: 1, command: 0, keyword: 0 },
    ...over,
  };
}

/** Two active lessons: one file-reachable, one keyword-only (unreachable on file/cmd). */
const graph: LessonsGraph = {
  version: 1,
  lessons: {
    reachable: {
      rule: 'A'.repeat(40), // 40 chars -> 10 est tokens
      topics: ['t'],
      triggers: ['t-glob'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    conceptual: {
      rule: 'B'.repeat(80), // 80 chars -> 20 est tokens
      topics: ['t'],
      triggers: ['t-kw'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    deadOne: {
      rule: 'C'.repeat(400),
      topics: ['t'],
      triggers: ['t-kw'],
      evidence: [],
      status: 'deprecated',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: {
    't-glob': { kind: 'file_glob', pattern: 'src/**' },
    't-kw': { kind: 'keyword', pattern: 'concept' },
  },
};

describe('summarizeRecall', () => {
  it('reports recall count and no-match rate', () => {
    const r = summarizeRecall(
      [rec(), rec({ totalMatches: 0, returnedCount: 0, returnedTokens: 0 })],
      graph,
    );
    expect(r.totalRecalls).toBe(2);
    expect(r.noMatchRate).toBe(0.5);
  });

  it('buckets total-match counts', () => {
    const r = summarizeRecall(
      [
        rec({ totalMatches: 0 }),
        rec({ totalMatches: 1 }),
        rec({ totalMatches: 3 }),
        rec({ totalMatches: 12 }),
      ],
      graph,
    );
    const counts = Object.fromEntries(r.matchCountHistogram.map((b) => [b.bucket, b.count]));
    expect(counts).toMatchObject({ '0': 1, '1': 1, '2-3': 1, '10+': 1 });
  });

  it('computes returned-token percentiles and cumulative cost', () => {
    const r = summarizeRecall(
      [rec({ returnedTokens: 10 }), rec({ returnedTokens: 20 }), rec({ returnedTokens: 100 })],
      graph,
    );
    expect(r.cumulativeRecallTokens).toBe(130);
    expect(r.returnedTokens.max).toBe(100);
    expect(r.returnedTokens.p50).toBe(20);
  });

  it('computes the whole-active-set preload baseline and break-even', () => {
    // Active rules: 40 + 80 chars -> 10 + 20 = 30 est tokens. Deprecated excluded.
    const cheap = summarizeRecall([rec({ returnedTokens: 5 })], graph); // cumulative 5 < 30
    expect(cheap.wholeActiveSetTokens).toBe(30);
    expect(cheap.preloadBreakEven.perActionCheaper).toBe(true);

    const heavy = summarizeRecall(
      Array.from({ length: 10 }, () => rec({ returnedTokens: 9 })),
      graph,
    ); // 90 > 30
    expect(heavy.preloadBreakEven.perActionCheaper).toBe(false);
    expect(heavy.preloadBreakEven.ratio).toBeCloseTo(3, 5);
  });

  it('measures reachability: keyword-only recall rate and keyword-only-unreachable lessons', () => {
    const r = summarizeRecall(
      [
        rec({ totalMatches: 1, matchedByKind: { file: 1, command: 0, keyword: 0 } }),
        rec({ totalMatches: 1, matchedByKind: { file: 0, command: 0, keyword: 1 } }),
        rec({ totalMatches: 0, matchedByKind: { file: 0, command: 0, keyword: 0 } }),
      ],
      graph,
    );
    // 1 of 2 matched recalls fired only via keyword.
    expect(r.reachability.keywordOnlyRecallRate).toBe(0.5);
    // Only `conceptual` is active + all-keyword (deadOne is deprecated).
    expect(r.reachability.keywordOnlyUnreachableLessons).toBe(1);
  });

  it('is safe on an empty log', () => {
    const r = summarizeRecall([], graph);
    expect(r.totalRecalls).toBe(0);
    expect(r.noMatchRate).toBe(0);
    expect(r.reachability.keywordOnlyRecallRate).toBe(0);
  });

  it('handles a graph with no active lessons (preload baseline 0, ratio 0)', () => {
    const empty: LessonsGraph = { version: 1, lessons: {}, topics: {}, triggers: {} };
    const r = summarizeRecall([rec({ returnedTokens: 50 })], empty);
    expect(r.wholeActiveSetTokens).toBe(0);
    expect(r.preloadBreakEven.ratio).toBe(0);
    expect(r.preloadBreakEven.perActionCheaper).toBe(false);
    expect(r.reachability.keywordOnlyUnreachableLessons).toBe(0);
  });
});
