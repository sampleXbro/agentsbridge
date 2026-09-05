/**
 * A keyword trigger can match a --file query incidentally through path tokens
 * ("lessons recall" inside src/lessons/recall.ts). That is weaker evidence than
 * a glob written about the path, so it must not tie with an exact match.
 */
import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { buildNarrowness } from '../../../src/lessons/ranking-signals.js';

const graph = {
  version: 1,
  lessons: {},
  topics: {},
  triggers: {
    exact: { kind: 'file_glob', pattern: 'src/lessons/recall.ts' },
    subtree: { kind: 'file_glob', pattern: 'src/lessons/**' },
    kw: { kind: 'keyword', pattern: 'lessons recall' },
    cmd: { kind: 'command_pattern', pattern: '\\bvitest\\b' },
    repoWide: { kind: 'file_glob', pattern: 'src/**' },
  },
} as unknown as LessonsGraph;

describe('buildNarrowness', () => {
  it('ranks any deliberate glob above a keyword, and a keyword above a repo-wide glob', () => {
    const n = buildNarrowness(graph);
    expect(n.get('exact')!).toBeGreaterThan(n.get('subtree')!);
    expect(n.get('subtree')!).toBeGreaterThan(n.get('kw')!);
    expect(n.get('kw')!).toBeGreaterThan(n.get('repoWide')!);
  });

  it('keeps command patterns neutral, so command queries rank as before', () => {
    expect(buildNarrowness(graph).get('cmd')).toBe(1);
  });

  it('scores every known trigger', () => {
    expect([...buildNarrowness(graph).keys()].sort()).toEqual([
      'cmd',
      'exact',
      'kw',
      'repoWide',
      'subtree',
    ]);
  });
});

describe('specificity outweighs any single weaker signal', () => {
  it('keeps the exact-path lesson first when a subtree rival wins topic coherence', async () => {
    const { queryLessons } = await import('../../../src/lessons/query.js');
    const { rankLessons } = await import('../../../src/lessons/ranking.js');
    const make = (rule: string, trigger: string, topic: string): unknown => ({
      rule,
      topics: [topic],
      triggers: [trigger],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    });
    // Two subtree lessons share a topic, so topic coherence favours them over
    // the lone pinpoint lesson. Specificity must still decide.
    const g = {
      version: 1,
      lessons: {
        pinpoint: make('Ordering statement about the recall entry point.', 'exact', 'solo'),
        subtreeA: make('Ordering statement about the lessons subsystem.', 'subtree', 'crowd'),
        subtreeB: make('Ordering statement about the source tree.', 'subtree2', 'crowd'),
      },
      topics: { solo: { summary: 'S.' }, crowd: { summary: 'C.' } },
      triggers: {
        exact: { kind: 'file_glob', pattern: 'src/lessons/recall.ts' },
        subtree: { kind: 'file_glob', pattern: 'src/lessons/**' },
        subtree2: { kind: 'file_glob', pattern: 'src/**' },
      },
    } as unknown as Parameters<typeof queryLessons>[0];
    const query = { file: 'src/lessons/recall.ts' };
    const ranked = rankLessons(g, query, queryLessons(g, query), {});
    expect(ranked.map((r) => r.id)).toEqual(['pinpoint', 'subtreeA', 'subtreeB']);
  });
});
