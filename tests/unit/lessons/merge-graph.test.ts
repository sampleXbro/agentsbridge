import { describe, expect, it } from 'vitest';
import type { Lesson, LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { mergeGraphs } from '../../../src/lessons/merge-graph.js';

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
