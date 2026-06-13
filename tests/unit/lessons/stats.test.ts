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

  it('compares preload PER SESSION against mandatory (non---all) recall', () => {
    // Active rules: 40 + 80 chars -> 10 + 20 = 30 est tokens. Deprecated excluded.
    // 10 recalls within one session × 9 tokens = 90 mandatory; preload = 30 × 1
    // session = 30 → preload still cheaper here, ratio = preload/recall = 30/90.
    const heavy = summarizeRecall(
      Array.from({ length: 10 }, (_, i) => rec({ ts: `2026-06-07T00:0${i}:00.000Z`, returnedTokens: 9 })),
      graph,
    );
    expect(heavy.wholeActiveSetTokens).toBe(30);
    expect(heavy.preloadBreakEven.sessions).toBe(1);
    expect(heavy.preloadBreakEven.preloadTokens).toBe(30);
    expect(heavy.preloadBreakEven.mandatoryRecallTokens).toBe(90);
    expect(heavy.preloadBreakEven.recallCheaper).toBe(false);
    expect(heavy.preloadBreakEven.ratio).toBeCloseTo(30 / 90, 5);
  });

  it('multiplies preload by the session count — the fix for the single-preload bug', () => {
    // The SAME 10 light recalls, but each in its own session (>30-min gaps):
    // preload = 30 × 10 sessions = 300 vs 10 × 9 = 90 mandatory → recall now wins.
    const spread = summarizeRecall(
      Array.from({ length: 10 }, (_, i) =>
        rec({ ts: `2026-06-07T${String(i * 2).padStart(2, '0')}:00:00.000Z`, returnedTokens: 9 }),
      ),
      graph,
    );
    expect(spread.preloadBreakEven.sessions).toBe(10);
    expect(spread.preloadBreakEven.preloadTokens).toBe(300);
    expect(spread.preloadBreakEven.recallCheaper).toBe(true);
    expect(spread.preloadBreakEven.ratio).toBeCloseTo(300 / 90, 5);
  });

  it('groups recalls by explicit session id when the harness exports one', () => {
    const r = summarizeRecall(
      [rec({ session: 'a' }), rec({ session: 'a' }), rec({ session: 'b' })],
      graph,
    );
    expect(r.preloadBreakEven.sessions).toBe(2);
  });

  it('excludes --all (bypassed) recalls from the mandatory recall cost', () => {
    const r = summarizeRecall(
      [rec({ returnedTokens: 50 }), rec({ returnedTokens: 999, bypassed: true })],
      graph,
    );
    expect(r.bypassedRecalls).toBe(1);
    expect(r.preloadBreakEven.mandatoryRecallTokens).toBe(50);
    // The cumulative figure still reflects every byte delivered, dumps included.
    expect(r.cumulativeRecallTokens).toBe(1049);
  });

  it('measures intra-session repeat delivery from lesson ids', () => {
    // Same session (identical ts): `reachable` (10 tokens) delivered twice — the
    // second delivery is redundant. accounted = 20, redundant = 10 → rate 0.5.
    const r = summarizeRecall(
      [rec({ lessonIds: ['reachable'] }), rec({ lessonIds: ['reachable'] })],
      graph,
    );
    expect(r.redundancy.rate).toBe(0.5);
    expect(r.redundancy.coverage).toBe(1);
  });

  it('does NOT count a lesson re-delivered in a DIFFERENT session as redundant', () => {
    const r = summarizeRecall(
      [
        rec({ ts: '2026-06-01T00:00:00.000Z', lessonIds: ['reachable'] }),
        rec({ ts: '2026-06-02T00:00:00.000Z', lessonIds: ['reachable'] }),
      ],
      graph,
    );
    expect(r.redundancy.rate).toBe(0);
  });

  it('reports redundancy coverage 0 when records predate the lessonIds field', () => {
    const r = summarizeRecall([rec({ returnedTokens: 5 })], graph); // no lessonIds
    expect(r.redundancy.coverage).toBe(0);
    expect(r.redundancy.rate).toBe(0);
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
    expect(r.preloadBreakEven.preloadTokens).toBe(0);
    expect(r.preloadBreakEven.ratio).toBe(0);
    expect(r.preloadBreakEven.recallCheaper).toBe(false);
    expect(r.reachability.keywordOnlyUnreachableLessons).toBe(0);
  });
});
