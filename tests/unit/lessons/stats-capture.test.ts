import { describe, expect, it } from 'vitest';
import { summarizeCapture } from '../../../src/lessons/stats-capture.js';
import type { CaptureTelemetryRecord } from '../../../src/lessons/capture-telemetry.js';

function rec(over: Partial<CaptureTelemetryRecord> = {}): CaptureTelemetryRecord {
  return {
    ts: '2026-06-11T00:00:00.000Z',
    isNewLesson: true,
    isNewTopic: false,
    newTriggerCount: 1,
    triggerKinds: { file: 1, command: 0, keyword: 0 },
    blocked: false,
    warningCodes: [],
    ...over,
  };
}

describe('summarizeCapture', () => {
  it('is safe on an empty log', () => {
    const r = summarizeCapture([]);
    expect(r).toEqual({
      total: 0,
      blocked: 0,
      newLessons: 0,
      upserts: 0,
      newTopics: 0,
      withWarnings: 0,
      byTriggerKind: { file: 0, command: 0, keyword: 0 },
    });
  });

  it('counts totals, blocks, new vs upsert, new topics, and warned captures', () => {
    const r = summarizeCapture([
      rec({ isNewLesson: true, isNewTopic: true }),
      rec({ isNewLesson: false, warningCodes: ['BROAD_GLOB_TRIGGER'] }),
      rec({ blocked: true, isNewLesson: false }),
    ]);
    expect(r.total).toBe(3);
    expect(r.blocked).toBe(1);
    // New/upsert counts exclude blocked captures (a block created nothing).
    expect(r.newLessons).toBe(1);
    expect(r.upserts).toBe(1);
    expect(r.newTopics).toBe(1);
    expect(r.withWarnings).toBe(1);
  });

  it('sums trigger kinds across captures (input kinds, blocked included)', () => {
    const r = summarizeCapture([
      rec({ triggerKinds: { file: 1, command: 1, keyword: 0 } }),
      rec({ blocked: true, triggerKinds: { file: 0, command: 0, keyword: 2 } }),
    ]);
    expect(r.byTriggerKind).toEqual({ file: 1, command: 1, keyword: 2 });
  });
});
