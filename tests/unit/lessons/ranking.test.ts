import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { queryLessons } from '../../../src/lessons/query.js';
import { rankLessons } from '../../../src/lessons/ranking.js';

function graph(): LessonsGraph {
  return {
    version: 1,
    lessons: {
      win: {
        rule: 'Normalize windows path separators to forward slashes everywhere.',
        topics: ['t'],
        triggers: ['broad'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-01',
      },
      unrel: {
        rule: 'Prefer interfaces over type aliases for object shapes.',
        topics: ['t'],
        triggers: ['broad'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-01',
      },
      specific: {
        rule: 'The cli foo helper must validate its input before use.',
        topics: ['t'],
        triggers: ['narrow'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-01',
      },
    },
    topics: { t: { summary: 'T.' } },
    triggers: {
      broad: { kind: 'file_glob', pattern: 'src/**' },
      narrow: { kind: 'file_glob', pattern: 'src/cli/foo.ts' },
    },
  };
}

function rankIds(
  g: LessonsGraph,
  query: Parameters<typeof queryLessons>[1],
  opts?: Parameters<typeof rankLessons>[3],
): string[] {
  return rankLessons(g, query, queryLessons(g, query), opts).map((r) => r.id);
}

describe('rankLessons', () => {
  it('ranks a lesson whose RULE TEXT matches the query above one sharing the same trigger (BM25 tie-break)', () => {
    const g = graph();
    const ids = rankIds(g, { file: 'src/x.ts', keyword: 'windows path' });
    expect(ids).toEqual(['win', 'unrel']);
  });

  it('ranks a specific (low-fanout) trigger match above a broad (high-fanout) one', () => {
    const g = graph();
    const ranked = rankLessons(
      g,
      { file: 'src/cli/foo.ts' },
      queryLessons(g, { file: 'src/cli/foo.ts' }),
    );
    expect(ranked[0]?.id).toBe('specific');
  });

  it('caps the result count with limit', () => {
    const g = graph();
    const ids = rankIds(g, { file: 'src/x.ts', keyword: 'windows path' }, { limit: 1 });
    expect(ids).toEqual(['win']);
  });

  it('caps by cumulative token budget with maxTokens (always keeps the top result)', () => {
    const g = graph();
    const ids = rankIds(g, { file: 'src/x.ts', keyword: 'windows path' }, { maxTokens: 15 });
    expect(ids).toEqual(['win']);
  });

  it('includes subsequent results that fit within the token budget', () => {
    const g = graph();
    // Budget large enough for the top result plus the next (both ~16 tokens),
    // exercising the "row fits → keep" branch, not just the break.
    const ids = rankIds(g, { file: 'src/a.ts' }, { maxTokens: 1000 });
    expect(ids.length).toBeGreaterThan(1);
  });

  it('exposes the matched triggers as the ranking reason', () => {
    const g = graph();
    const ranked = rankLessons(g, { file: 'src/x.ts' }, queryLessons(g, { file: 'src/x.ts' }));
    const winRow = ranked.find((r) => r.id === 'win');
    expect(winRow?.reason.matchedTriggers).toEqual(['broad']);
  });

  it('is deterministic and returns every match when uncapped', () => {
    const g = graph();
    const ids = rankIds(g, { file: 'src/cli/foo.ts' });
    expect(ids.slice().sort()).toEqual(['specific', 'unrel', 'win']);
    expect(rankIds(g, { file: 'src/cli/foo.ts' })).toEqual(ids);
  });

  it('breaks score ties by recency then id, and ignores inactive lessons in the corpus', () => {
    const g: LessonsGraph = {
      version: 1,
      lessons: {
        newer: {
          rule: 'Plain rule one.',
          topics: ['t'],
          triggers: ['broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-02',
        },
        older: {
          rule: 'Plain rule two.',
          topics: ['t'],
          triggers: ['broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'older-b': {
          rule: 'Plain rule three.',
          topics: ['t'],
          triggers: ['broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        dead: {
          rule: 'Inactive rule.',
          topics: ['t'],
          triggers: ['broad'],
          evidence: [],
          status: 'deprecated',
          createdAt: '2026-06-01',
        },
      },
      topics: { t: { summary: 'T.' } },
      triggers: { broad: { kind: 'file_glob', pattern: 'src/**' } },
    };
    // No query terms hit any rule → equal bm25 and equal specificity → equal
    // score → tie-break by createdAt (newer first) then id. `dead` is excluded.
    const ids = rankLessons(g, { file: 'src/x.ts' }, queryLessons(g, { file: 'src/x.ts' })).map(
      (r) => r.id,
    );
    expect(ids).toEqual(['newer', 'older', 'older-b']);
  });

  it('handles a stopword-only corpus without dividing by zero', () => {
    const g: LessonsGraph = {
      version: 1,
      lessons: {
        a: {
          rule: 'the and or of to',
          topics: ['t'],
          triggers: ['broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        b: {
          rule: 'a an in on at',
          topics: ['t'],
          triggers: ['broad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
      topics: { t: { summary: 'T.' } },
      triggers: { broad: { kind: 'file_glob', pattern: 'src/**' } },
    };
    const ids = rankLessons(
      g,
      { file: 'src/x.ts', keyword: 'the of' },
      queryLessons(g, { file: 'src/x.ts' }),
    ).map((r) => r.id);
    expect(ids.slice().sort()).toEqual(['a', 'b']);
  });

  it('returns empty for no matches', () => {
    const g = graph();
    expect(rankLessons(g, { file: 'docs/x.md' }, queryLessons(g, { file: 'docs/x.md' }))).toEqual(
      [],
    );
  });
});
