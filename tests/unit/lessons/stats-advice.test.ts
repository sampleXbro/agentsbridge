import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { statsAdvice } from '../../../src/lessons/stats-advice.js';
import { summarizeRecall } from '../../../src/lessons/stats.js';
import type { RecallTelemetryRecord } from '../../../src/lessons/telemetry.js';

const rec = (over: Partial<RecallTelemetryRecord>): RecallTelemetryRecord => ({
  ts: '2026-01-01T00:00:00Z',
  hasFile: false,
  hasCommand: true,
  hasKeyword: false,
  totalMatches: 0,
  returnedCount: 0,
  returnedTokens: 0,
  truncated: false,
  matchedByKind: { file: 0, command: 0, keyword: 0 },
  ...over,
});

const GRAPH: LessonsGraph = {
  version: 2,
  topics: { t: { summary: 't' } },
  triggers: {
    'glob-src': { kind: 'file_glob', pattern: 'src/**' },
    'cmd-1': { kind: 'command_pattern', pattern: 'git commit' },
  },
  lessons: {
    l1: {
      rule: 'r1',
      topics: ['t'],
      triggers: ['glob-src', 'cmd-1'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
    },
  },
};

const advise = (records: RecallTelemetryRecord[]): string[] =>
  statsAdvice(records, GRAPH, summarizeRecall(records, GRAPH));

describe('statsAdvice', () => {
  it('diagnoses inert dedup: high redundancy with no session coverage', () => {
    const delivered = {
      hasFile: true,
      hasCommand: false,
      totalMatches: 1,
      returnedCount: 1,
      returnedTokens: 100,
      lessonIds: ['l1'],
    };
    const records = [
      rec({ ...delivered, ts: '2026-01-01T00:00:00Z' }),
      rec({ ...delivered, ts: '2026-01-01T00:01:00Z' }),
    ];
    const advice = advise(records);
    expect(advice).toHaveLength(1);
    expect(advice[0]).toMatch(/session dedup is inert/);
    expect(advice[0]).toContain('--session auto');
  });

  it('stays silent on high redundancy when sessions ARE threaded (different cause)', () => {
    const delivered = {
      hasFile: true,
      hasCommand: false,
      totalMatches: 1,
      returnedCount: 1,
      returnedTokens: 100,
      lessonIds: ['l1'],
      session: 's1',
    };
    const records = [
      rec({ ...delivered, ts: '2026-01-01T00:00:00Z' }),
      rec({ ...delivered, ts: '2026-01-01T00:01:00Z' }),
    ];
    expect(advise(records)).toEqual([]);
  });

  it('diagnoses command-trigger starvation: no-matches dominated by command-only recalls', () => {
    const records = [
      ...Array.from({ length: 6 }, (_, i) =>
        rec({ ts: `2026-01-01T00:0${i}:00Z`, session: 's1' }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        rec({
          ts: `2026-01-01T00:1${i}:00Z`,
          session: 's1',
          hasFile: true,
          hasCommand: false,
          totalMatches: 1,
          returnedCount: 1,
          returnedTokens: 50,
          lessonIds: ['l1'],
          matchedByKind: { file: 1, command: 0, keyword: 0 },
        }),
      ),
    ];
    const advice = advise(records);
    expect(advice).toHaveLength(1);
    expect(advice[0]).toMatch(/command-shaped lessons are starving/);
    expect(advice[0]).toContain('1 command_pattern trigger');
    expect(advice[0]).toContain('--trigger-cmd');
  });

  it('returns no advice for a healthy profile', () => {
    const records = [
      rec({
        ts: '2026-01-01T00:00:00Z',
        session: 's1',
        hasFile: true,
        hasCommand: false,
        totalMatches: 1,
        returnedCount: 1,
        returnedTokens: 50,
        lessonIds: ['l1'],
      }),
    ];
    expect(advise(records)).toEqual([]);
  });

  it('returns no advice on an empty log', () => {
    expect(advise([])).toEqual([]);
  });

  it('stays silent at redundancy exactly 25% (strict greater-than)', () => {
    // Redundancy weighs GRAPH rule tokens, so every delivered id must exist and
    // the rules must share a length. Three fresh + one repeat = exactly 25%.
    const sameLenRule = (n: number): string => `rule number ${n} with same len`;
    const boundaryGraph: LessonsGraph = {
      ...GRAPH,
      lessons: Object.fromEntries(
        [1, 2, 3].map((n) => [
          `l${n}`,
          {
            rule: sameLenRule(n),
            topics: ['t'],
            triggers: ['glob-src'],
            evidence: [],
            status: 'active' as const,
            createdAt: '2026-01-01',
          },
        ]),
      ),
    };
    const fresh = (id: string, ts: string): RecallTelemetryRecord =>
      rec({
        ts,
        hasFile: true,
        hasCommand: false,
        totalMatches: 1,
        returnedCount: 1,
        returnedTokens: 100,
        lessonIds: [id],
      });
    const records = [
      fresh('l1', '2026-01-01T00:00:00Z'),
      fresh('l2', '2026-01-01T00:01:00Z'),
      fresh('l3', '2026-01-01T00:02:00Z'),
      fresh('l1', '2026-01-01T00:03:00Z'),
    ];
    const advice = statsAdvice(records, boundaryGraph, summarizeRecall(records, boundaryGraph));
    expect(advice).toEqual([]);
  });

  it('stays silent at a no-match rate of exactly 50% (strict greater-than)', () => {
    const records = [
      rec({ ts: '2026-01-01T00:00:00Z', session: 's1' }),
      rec({ ts: '2026-01-01T00:01:00Z', session: 's1' }),
      ...[2, 3].map((i) =>
        rec({
          ts: `2026-01-01T00:0${i}:00Z`,
          session: 's1',
          hasFile: true,
          hasCommand: false,
          totalMatches: 1,
          returnedCount: 1,
          returnedTokens: 50,
          lessonIds: ['l1'],
        }),
      ),
    ];
    expect(advise(records)).toEqual([]);
  });

  it('excludes always-scope lessons from the command-trigger count', () => {
    const withAlways: LessonsGraph = {
      ...GRAPH,
      triggers: {
        ...GRAPH.triggers,
        'cmd-always': { kind: 'command_pattern', pattern: 'always cmd' },
      },
      lessons: {
        ...GRAPH.lessons,
        la: {
          rule: 'universal',
          topics: ['t'],
          triggers: ['cmd-always'],
          evidence: [],
          status: 'active',
          createdAt: '2026-01-01',
          scope: 'always',
        },
      },
    };
    const records = Array.from({ length: 6 }, (_, i) =>
      rec({ ts: `2026-01-01T00:0${i}:00Z`, session: 's1' }),
    );
    const advice = statsAdvice(records, withAlways, summarizeRecall(records, withAlways));
    expect(advice).toHaveLength(1);
    // The always-scope lesson's trigger must not inflate the reachable count.
    expect(advice[0]).toContain('1 command_pattern trigger');
  });
});
