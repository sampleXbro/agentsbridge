import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendOutcomeEvent,
  readOutcomeLog,
  outcomeLogPath,
  effectiveness,
  effectivenessScore,
  loadEffectiveness,
  recordDelivered,
  recordFailure,
  failuresForContext,
  type OutcomeEvent,
} from '../../../src/lessons/outcome-log.js';

const ON = { AGENTSMESH_LESSONS_TELEMETRY: '1' } as NodeJS.ProcessEnv;

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-outcome-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const delivered = (lessonId: string, contextKey: string, session?: string): OutcomeEvent => ({
  ts: '2026-01-01T00:00:00Z',
  kind: 'delivered',
  lessonId,
  contextKey,
  ...(session !== undefined ? { session } : {}),
});
const failure = (contextKey: string, session?: string): OutcomeEvent => ({
  ts: '2026-01-01T00:00:00Z',
  kind: 'failure',
  contextKey,
  ...(session !== undefined ? { session } : {}),
});

describe('outcome-log persistence (telemetry side-channel)', () => {
  it('is a no-op when telemetry is disabled — no file, empty read', () => {
    appendOutcomeEvent(root, delivered('l1', 'k1'), {} as NodeJS.ProcessEnv);
    expect(existsSync(outcomeLogPath(root))).toBe(false);
    expect(readOutcomeLog(root)).toEqual([]);
  });

  it('appends and reads back records when telemetry is enabled', () => {
    appendOutcomeEvent(root, delivered('l1', 'k1', 's1'), ON);
    appendOutcomeEvent(root, failure('k1', 's1'), ON);
    expect(outcomeLogPath(root).endsWith('.agentsmesh/lessons/outcome-log.jsonl')).toBe(true);
    expect(readOutcomeLog(root)).toEqual([delivered('l1', 'k1', 's1'), failure('k1', 's1')]);
  });
});

describe('effectiveness derivation (pure)', () => {
  it('a delivery is a MISS when the same contextKey fails later in the same session', () => {
    const e = effectiveness([delivered('l1', 'k1', 's1'), failure('k1', 's1')]);
    expect(e.get('l1')).toEqual({ delivered: 1, missed: 1 });
  });

  it('a delivery is NOT a miss when no later same-key failure follows', () => {
    const e = effectiveness([delivered('l1', 'k1', 's1'), failure('k2', 's1')]);
    expect(e.get('l1')).toEqual({ delivered: 1, missed: 0 });
  });

  it('a failure BEFORE the delivery does not impeach it (only later failures count)', () => {
    const e = effectiveness([failure('k1', 's1'), delivered('l1', 'k1', 's1')]);
    expect(e.get('l1')).toEqual({ delivered: 1, missed: 0 });
  });

  it('a failure in a DIFFERENT session does not impeach the delivery', () => {
    const e = effectiveness([delivered('l1', 'k1', 's1'), failure('k1', 's2')]);
    expect(e.get('l1')).toEqual({ delivered: 1, missed: 0 });
  });

  it('accumulates across multiple deliveries of the same lesson', () => {
    const e = effectiveness([
      delivered('l1', 'k1', 's1'),
      failure('k1', 's1'), // impeaches the first
      delivered('l1', 'k2', 's2'), // helped (no later k2 failure)
    ]);
    expect(e.get('l1')).toEqual({ delivered: 2, missed: 1 });
  });

  it('a same-scope failure impeaches only the delivery BEFORE it, not one after', () => {
    const e = effectiveness([
      delivered('l1', 'k1', 's1'), // before the failure → miss
      failure('k1', 's1'),
      delivered('l1', 'k1', 's1'), // after the failure, no later one → not a miss
    ]);
    expect(e.get('l1')).toEqual({ delivered: 2, missed: 1 });
  });

  it('scores: undelivered → neutral 1; all-missed → 0; half → 0.5', () => {
    expect(effectivenessScore({ delivered: 0, missed: 0 })).toBe(1);
    expect(effectivenessScore({ delivered: 3, missed: 3 })).toBe(0);
    expect(effectivenessScore({ delivered: 2, missed: 1 })).toBe(0.5);
  });

  it('loadEffectiveness derives per-lesson scores from the written log', () => {
    appendOutcomeEvent(root, delivered('l1', 'k1', 's1'), ON);
    appendOutcomeEvent(root, failure('k1', 's1'), ON);
    appendOutcomeEvent(root, delivered('l2', 'k9', 's1'), ON);
    const scores = loadEffectiveness(root);
    expect(scores.get('l1')).toBe(0); // fired, mistake recurred
    expect(scores.get('l2')).toBe(1); // fired, no recurrence
    expect(scores.get('lX')).toBeUndefined(); // never delivered → neutral (absent)
  });
});

describe('record helpers (stamp ts + session, gated on telemetry)', () => {
  const withSession = {
    AGENTSMESH_LESSONS_TELEMETRY: '1',
    AGENTSMESH_SESSION_ID: 's1',
  } as NodeJS.ProcessEnv;

  it('recordDelivered writes one delivered event per lesson id; no-op when telemetry is off', () => {
    recordDelivered(root, ['l1', 'l2'], 'file:x', {} as NodeJS.ProcessEnv);
    expect(readOutcomeLog(root)).toEqual([]);

    recordDelivered(root, ['l1', 'l2'], 'file:x', withSession);
    const recs = readOutcomeLog(root);
    expect(
      recs.map((r) => ({
        kind: r.kind,
        lessonId: r.kind === 'delivered' ? r.lessonId : undefined,
        contextKey: r.contextKey,
        session: r.session,
      })),
    ).toEqual([
      { kind: 'delivered', lessonId: 'l1', contextKey: 'file:x', session: 's1' },
      { kind: 'delivered', lessonId: 'l2', contextKey: 'file:x', session: 's1' },
    ]);
    expect(typeof recs[0]!.ts).toBe('string');
  });

  it('recordDelivered no-ops on an empty id list', () => {
    recordDelivered(root, [], 'file:x', withSession);
    expect(readOutcomeLog(root)).toEqual([]);
  });

  it('recordFailure writes one failure event; session absent when the env is unset', () => {
    recordFailure(root, 'file:x', undefined, {
      AGENTSMESH_LESSONS_TELEMETRY: '1',
    } as NodeJS.ProcessEnv);
    const recs = readOutcomeLog(root);
    expect(recs.length).toBe(1);
    expect(recs[0]!.kind).toBe('failure');
    expect(recs[0]!.contextKey).toBe('file:x');
    expect(recs[0]!.session).toBeUndefined();
  });

  it('recordFailure carries an error class when provided', () => {
    recordFailure(root, 'cmd:build', 'typeerror: boom', {
      AGENTSMESH_LESSONS_TELEMETRY: '1',
    } as NodeJS.ProcessEnv);
    const rec = readOutcomeLog(root)[0]!;
    expect(rec).toMatchObject({
      kind: 'failure',
      contextKey: 'cmd:build',
      errorClass: 'typeerror: boom',
    });
  });
});

describe('failuresForContext (recurrence history, pure read)', () => {
  const ON = { AGENTSMESH_LESSONS_TELEMETRY: '1' } as NodeJS.ProcessEnv;

  it('counts only failures for the given contextKey and returns the latest error class', () => {
    recordFailure(root, 'cmd:build', 'error a', ON);
    recordFailure(root, 'file:x', 'error other', ON);
    recordFailure(root, 'cmd:build', 'error b', ON);
    expect(failuresForContext(root, 'cmd:build')).toEqual({ count: 2, lastErrorClass: 'error b' });
  });

  it('is zero for an action that has never failed', () => {
    expect(failuresForContext(root, 'cmd:never')).toEqual({ count: 0 });
  });
});
