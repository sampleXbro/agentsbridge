import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import {
  isKeywordOnlyQuery,
  LEXICAL_LIMIT,
  lexicalCandidates,
} from '../../../src/lessons/lexical-retrieval.js';

const STRONG =
  'Reveal an animateMotion driven SVG element on the SMIL clock, never with a CSS delay.';
const lesson = (
  rule: string,
  extra: Partial<LessonsGraph['lessons'][string]> = {},
): LessonsGraph['lessons'][string] => ({
  rule,
  topics: ['t'],
  triggers: ['kw'],
  evidence: [],
  status: 'active',
  createdAt: '2026-06-01',
  ...extra,
});

const graph: LessonsGraph = {
  version: 2,
  lessons: {
    strong: lesson(STRONG),
    weak: lesson('Keep the SVG viewBox stable across variants.'),
    retired: lesson(STRONG, { status: 'deprecated' }),
    ambient: lesson(STRONG, { scope: 'always' }),
    already: lesson(STRONG),
    noise: lesson('Prefer interfaces over type aliases for object shapes.'),
  },
  topics: { t: { summary: 'T.' } },
  triggers: { kw: { kind: 'keyword', pattern: 'zzz-never-matches' } },
};

const PROMPT = 'the SVG animation clock keeps dots parked in the corner';

describe('lexicalCandidates', () => {
  it('returns active lessons sharing at least two distinct query terms, flagged as lexical', () => {
    const out = lexicalCandidates(graph, PROMPT, ['already']);
    expect(out.map((m) => m.id)).toEqual(['strong']);
    expect(out[0]!.lexical).toBe(true);
  });

  it('skips one-term overlaps, retired lessons, always-on lessons and excluded ids', () => {
    const ids = lexicalCandidates(graph, PROMPT, ['already']).map((m) => m.id);
    expect(ids).not.toContain('weak');
    expect(ids).not.toContain('retired');
    expect(ids).not.toContain('ambient');
    expect(ids).not.toContain('already');
    expect(ids).not.toContain('noise');
  });

  it('caps the candidate list and orders it by score', () => {
    // Each lesson shares one more distinct query term than the last, so BM25
    // rises monotonically; the top three are the three richest overlaps.
    const shared = ['svg', 'clock', 'animation', 'dots', 'parked', 'corner'];
    const many: LessonsGraph = {
      ...graph,
      lessons: Object.fromEntries(
        [2, 3, 4, 5, 6].map((n) => [`l${n}`, lesson(`${shared.slice(0, n).join(' ')} rule.`)]),
      ),
    };
    const out = lexicalCandidates(many, PROMPT, []);
    expect(out).toHaveLength(LEXICAL_LIMIT);
    expect(out.map((m) => m.id)).toEqual(['l6', 'l5', 'l4']);
  });

  it('does not count generic English words toward the two-term gate', () => {
    // A real false positive: a merge-conflict-marker rule matched an SVG prompt
    // because both contained "top" and "left".
    const g: LessonsGraph = {
      ...graph,
      lessons: {
        generic: lesson(
          'When a fixture needs literal markers at module top level, the lexer scans for left-anchored markers.',
        ),
        specific: lesson(STRONG),
      },
    };
    const ids = lexicalCandidates(g, 'dots parked in the top left corner of the svg clock', []).map(
      (m) => m.id,
    );
    expect(ids).toEqual(['specific']);
  });

  it('is empty for a query with fewer than two usable terms', () => {
    expect(lexicalCandidates(graph, 'svg', [])).toEqual([]);
    expect(lexicalCandidates(graph, 'the a', [])).toEqual([]);
    expect(lexicalCandidates(graph, '', [])).toEqual([]);
  });
});

describe('isKeywordOnlyQuery', () => {
  it('is true only for a query carrying task text and no file or command', () => {
    expect(isKeywordOnlyQuery({ keyword: 'x y' })).toBe(true);
    expect(isKeywordOnlyQuery({ keyword: 'x y', file: 'src/a.ts' })).toBe(false);
    expect(isKeywordOnlyQuery({ keyword: 'x y', command: 'git commit' })).toBe(false);
    expect(isKeywordOnlyQuery({ file: 'src/a.ts' })).toBe(false);
    expect(isKeywordOnlyQuery({})).toBe(false);
  });
});
