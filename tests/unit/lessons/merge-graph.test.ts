import { describe, expect, it } from 'vitest';
import type { Lesson, LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { mergeGraphs } from '../../../src/lessons/merge-graph.js';
import { validateLessonsGraph } from '../../../src/lessons/validate.js';

function lesson(rule: string, status: Lesson['status'] = 'active'): Lesson {
  return { rule, topics: ['t'], triggers: [], evidence: [], status, createdAt: '2026-06-01' };
}
function graph(over: Partial<LessonsGraph> = {}): LessonsGraph {
  return { version: 1, lessons: {}, topics: { t: { summary: 'T.' } }, triggers: {}, ...over };
}

describe('mergeGraphs', () => {
  it('unions lessons each branch added independently (the parallel-capture case)', () => {
    const m = mergeGraphs(
      graph(),
      graph({ lessons: { a: lesson('A.') } }),
      graph({ lessons: { c: lesson('C.') } }),
    );
    expect(Object.keys(m.lessons).sort()).toEqual(['a', 'c']);
  });

  it('keeps a single copy when both branches added the identical lesson', () => {
    const g = graph({ lessons: { a: lesson('A.') } });
    const clone = JSON.parse(JSON.stringify(g)) as LessonsGraph;
    const m = mergeGraphs(graph(), g, clone);
    expect(Object.keys(m.lessons)).toEqual(['a']);
  });

  it('takes the side that changed an entry, three-way (unchanged side yields)', () => {
    const base = graph({ lessons: { a: lesson('A.') } });
    const m = mergeGraphs(base, base, graph({ lessons: { a: lesson('A.', 'deprecated') } }));
    expect(m.lessons.a!.status).toBe('deprecated');
  });

  it('prefers a deprecated lesson when both sides diverged the same entry', () => {
    const base = graph({ lessons: { a: lesson('A.') } });
    const ours = graph({ lessons: { a: { ...lesson('A.'), evidence: ['x'] } } });
    const theirs = graph({ lessons: { a: lesson('A.', 'deprecated') } });
    expect(mergeGraphs(base, ours, theirs).lessons.a!.status).toBe('deprecated');
  });

  it('unions triggers and topics across branches', () => {
    const m = mergeGraphs(
      graph(),
      graph({
        triggers: { 't-a': { kind: 'keyword', pattern: 'a' } },
        topics: { t: { summary: 'T.' }, x: { summary: 'X.' } },
      }),
      graph({ triggers: { 't-b': { kind: 'keyword', pattern: 'b' } } }),
    );
    expect(Object.keys(m.triggers).sort()).toEqual(['t-a', 't-b']);
    expect(Object.keys(m.topics).sort()).toEqual(['t', 'x']);
  });

  it('never drops an entry that exists on only one side', () => {
    const base = graph({ lessons: { a: lesson('A.'), b: lesson('B.') } });
    // ours keeps both; theirs dropped b — union keeps it (losing a lesson is worse).
    const ours = base;
    const theirs = graph({ lessons: { a: lesson('A.') } });
    expect(Object.keys(mergeGraphs(base, ours, theirs).lessons).sort()).toEqual(['a', 'b']);
  });
});

describe('mergeGraphs — pick() tie-break branches', () => {
  it('keeps our edit when theirs is identical to base (theirs unchanged)', () => {
    const base = graph({ lessons: { a: lesson('A.') } });
    const ours = graph({ lessons: { a: { ...lesson('A.'), evidence: ['ours'] } } });
    const theirs = JSON.parse(JSON.stringify(base)) as LessonsGraph;
    expect(mergeGraphs(base, ours, theirs).lessons.a!.evidence).toEqual(['ours']);
  });

  it('prefers OUR deprecation when ours is deprecated and theirs diverged active', () => {
    const base = graph({ lessons: { a: lesson('A.') } });
    const ours = graph({ lessons: { a: lesson('A.', 'deprecated') } });
    const theirs = graph({ lessons: { a: { ...lesson('A.'), evidence: ['x'] } } });
    expect(mergeGraphs(base, ours, theirs).lessons.a!.status).toBe('deprecated');
  });

  it('breaks a both-diverged, neither-deprecated tie deterministically by content', () => {
    const base = graph({ lessons: { a: lesson('A.') } });
    const withZ = graph({ lessons: { a: { ...lesson('A.'), evidence: ['zzz'] } } });
    const withA = graph({ lessons: { a: { ...lesson('A.'), evidence: ['aaa'] } } });
    // Same winner regardless of which side carries it → both arms of so>st covered.
    const winA = mergeGraphs(base, withZ, withA).lessons.a!.evidence;
    const winB = mergeGraphs(base, withA, withZ).lessons.a!.evidence;
    expect(winA).toEqual(winB);
  });
});

describe('mergeGraphs — cross-branch id collision (same id, different rule)', () => {
  const ruleOf = (g: LessonsGraph, rule: string): string | undefined =>
    Object.keys(g.lessons).find((id) => g.lessons[id]!.rule === rule);

  it('keeps BOTH rules when each branch minted the same id for a different lesson', () => {
    const m = mergeGraphs(
      graph(),
      graph({ lessons: { 'topic-use-x': lesson('Use X for A.') } }),
      graph({ lessons: { 'topic-use-x': lesson('Use X for B.') } }),
    );
    expect(Object.keys(m.lessons).sort()).toEqual(['topic-use-x', 'topic-use-x-2']);
    expect(ruleOf(m, 'Use X for A.')).toBeDefined();
    expect(ruleOf(m, 'Use X for B.')).toBeDefined();
    expect(validateLessonsGraph(m).ok).toBe(true);
  });

  it('is side-order independent: the same rule wins the bare id either way', () => {
    const a = graph({ lessons: { k: lesson('Rule A.') } });
    const b = graph({ lessons: { k: lesson('Rule B.') } });
    const ab = mergeGraphs(graph(), a, b);
    const ba = mergeGraphs(graph(), b, a);
    expect(ruleOf(ab, 'Rule A.')).toBeDefined();
    expect(ruleOf(ab, 'Rule B.')).toBeDefined();
    expect(ruleOf(ab, 'Rule A.')).toBe(ruleOf(ba, 'Rule A.'));
    expect(ruleOf(ab, 'Rule B.')).toBe(ruleOf(ba, 'Rule B.'));
  });

  it('skips suffixes already taken on either side (-2 taken → -3)', () => {
    const m = mergeGraphs(
      graph(),
      graph({ lessons: { k: lesson('Rule A.'), 'k-2': lesson('Rule C.') } }),
      graph({ lessons: { k: lesson('Rule B.') } }),
    );
    expect(Object.keys(m.lessons).sort()).toEqual(['k', 'k-2', 'k-3']);
    expect(m.lessons['k-2']!.rule).toBe('Rule C.');
    expect(validateLessonsGraph(m).ok).toBe(true);
  });

  it('remaps a same-side supersededBy chain that pointed at the re-keyed lesson', () => {
    const ours = graph({ lessons: { k: lesson('Rule A.') } });
    const theirs = graph({
      lessons: {
        k: lesson('Rule B.'),
        old: { ...lesson('Old B.', 'superseded'), supersededBy: 'k' },
      },
    });
    for (const m of [mergeGraphs(graph(), ours, theirs), mergeGraphs(graph(), theirs, ours)]) {
      expect(ruleOf(m, 'Rule A.')).toBeDefined();
      expect(m.lessons.old!.supersededBy).toBe(ruleOf(m, 'Rule B.'));
      expect(validateLessonsGraph(m).ok).toBe(true);
    }
  });

  it('is NOT a collision when only one side reworded the base rule (three-way edit)', () => {
    const base = graph({ lessons: { k: lesson('Rule A.') } });
    const m = mergeGraphs(base, base, graph({ lessons: { k: lesson('Rule A, reworded.') } }));
    expect(Object.keys(m.lessons)).toEqual(['k']);
    expect(m.lessons.k!.rule).toBe('Rule A, reworded.');
  });

  it('is NOT a collision when the rules match and only metadata differs', () => {
    const m = mergeGraphs(
      graph(),
      graph({ lessons: { k: { ...lesson('Rule A.'), evidence: ['x'] } } }),
      graph({ lessons: { k: { ...lesson('Rule A.'), evidence: ['y'] } } }),
    );
    expect(Object.keys(m.lessons)).toEqual(['k']);
  });
});
