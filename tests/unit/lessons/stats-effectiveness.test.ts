import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import type { OutcomeEvent } from '../../../src/lessons/outcome-log.js';
import { summarizeEffectiveness } from '../../../src/lessons/stats-effectiveness.js';

const GRAPH: LessonsGraph = {
  version: 2,
  lessons: {
    l1: {
      rule: 'r',
      topics: ['t'],
      triggers: ['g'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
    },
  },
  topics: { t: { summary: 't' } },
  triggers: { g: { kind: 'file_glob', pattern: 'src/**' } },
};
const d = (lessonId: string, k: string): OutcomeEvent => ({
  ts: '2026-01-01T00:00:00Z',
  kind: 'delivered',
  lessonId,
  contextKey: k,
  session: 's1',
});
const f = (k: string): OutcomeEvent => ({
  ts: '2026-01-01T00:00:00Z',
  kind: 'failure',
  contextKey: k,
  session: 's1',
});

describe('summarizeEffectiveness', () => {
  it('is neutral (heldRate 1, all zero) with no events', () => {
    expect(summarizeEffectiveness([], GRAPH)).toEqual({
      deliveries: 0,
      lessonsDelivered: 0,
      failuresObserved: 0,
      heldRate: 1,
      ineffectiveLessons: 0,
    });
  });

  it('held rate = fraction of deliveries NOT followed by a same-action repeat', () => {
    // l1 delivered for k1, then k1 fails (miss); l1 delivered for k2, no repeat (held).
    const r = summarizeEffectiveness([d('l1', 'k1'), f('k1'), d('l1', 'k2')], GRAPH);
    expect(r).toEqual({
      deliveries: 2,
      lessonsDelivered: 1,
      failuresObserved: 1,
      heldRate: 0.5,
      ineffectiveLessons: 0, // < 3 deliveries
    });
  });

  it('flags a lesson delivered >=3× that missed every time as ineffective', () => {
    const events = [d('l1', 'k1'), f('k1'), d('l1', 'k2'), f('k2'), d('l1', 'k3'), f('k3')];
    const r = summarizeEffectiveness(events, GRAPH);
    expect(r.deliveries).toBe(3);
    expect(r.heldRate).toBe(0);
    expect(r.ineffectiveLessons).toBe(1);
  });

  it('does not count a deprecated lesson as ineffective (nothing to act on)', () => {
    const graph: LessonsGraph = {
      ...GRAPH,
      lessons: { l1: { ...GRAPH.lessons.l1!, status: 'deprecated' } },
    };
    const events = [d('l1', 'k1'), f('k1'), d('l1', 'k2'), f('k2'), d('l1', 'k3'), f('k3')];
    expect(summarizeEffectiveness(events, graph).ineffectiveLessons).toBe(0);
  });
});
