import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { queryLessons } from '../../../src/lessons/query.js';
import { rankLessons } from '../../../src/lessons/ranking.js';

// Two lessons that tie on every frozen signal (same single trigger → same
// specificity, same topic → same coherence, identical rule → same BM25). The
// only differentiator is the effectiveness signal, so ordering isolates it.
function tiedGraph(): LessonsGraph {
  return {
    version: 2,
    topics: { t: { summary: 't' } },
    triggers: { 'kw-foo': { kind: 'keyword', pattern: 'foo' } },
    lessons: {
      'l-a': {
        rule: 'do foo carefully',
        topics: ['t'],
        triggers: ['kw-foo'],
        evidence: [],
        status: 'active',
        createdAt: '2026-01-01',
      },
      'l-b': {
        rule: 'do foo carefully',
        topics: ['t'],
        triggers: ['kw-foo'],
        evidence: [],
        status: 'active',
        createdAt: '2026-01-01',
      },
    },
  };
}

describe('rankLessons — effectiveness down-rank', () => {
  const graph = tiedGraph();
  const query = { keyword: 'foo' };
  const order = (opts: Parameters<typeof rankLessons>[3]): string[] =>
    rankLessons(graph, query, queryLessons(graph, query), opts).map((r) => r.id);

  it('with no effectiveness data, ordering is unchanged (id tie-break: l-a, l-b)', () => {
    expect(order({})).toEqual(['l-a', 'l-b']);
  });

  it('when both are equally effective, ordering is still unchanged', () => {
    expect(
      order({
        effectiveness: new Map([
          ['l-a', 1],
          ['l-b', 1],
        ]),
      }),
    ).toEqual(['l-a', 'l-b']);
  });

  it('sinks the fire-but-fail lesson below its equally-matched effective sibling', () => {
    // l-a fired but the mistake recurred (0); l-b always helped (1) → l-b first.
    expect(
      order({
        effectiveness: new Map([
          ['l-a', 0],
          ['l-b', 1],
        ]),
      }),
    ).toEqual(['l-b', 'l-a']);
  });

  it('never overrides a real specificity lead (nudge, not driver)', () => {
    // Give l-a a MORE specific (file) trigger it uniquely owns; even if l-a is
    // ineffective, its specificity lead must keep it on top.
    const g: LessonsGraph = {
      ...graph,
      triggers: { ...graph.triggers, 'glob-a': { kind: 'file_glob', pattern: 'src/a.ts' } },
      lessons: {
        ...graph.lessons,
        'l-a': { ...graph.lessons['l-a']!, triggers: ['kw-foo', 'glob-a'] },
      },
    };
    const q = { keyword: 'foo', file: 'src/a.ts' };
    const ranked = rankLessons(g, q, queryLessons(g, q), {
      effectiveness: new Map([
        ['l-a', 0],
        ['l-b', 1],
      ]),
    }).map((r) => r.id);
    expect(ranked[0]).toBe('l-a');
  });
});
