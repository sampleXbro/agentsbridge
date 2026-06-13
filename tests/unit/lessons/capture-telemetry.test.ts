import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendCaptureRecord,
  captureLogExists,
  captureLogPath,
  readCaptureLog,
  recordCapture,
  type CaptureTelemetryRecord,
} from '../../../src/lessons/capture-telemetry.js';
import { TELEMETRY_ENV, SESSION_ENV } from '../../../src/lessons/telemetry.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-cap-tel-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function record(over: Partial<CaptureTelemetryRecord> = {}): CaptureTelemetryRecord {
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

describe('appendCaptureRecord', () => {
  it('writes nothing when telemetry is disabled (default off)', () => {
    appendCaptureRecord(root, record(), {});
    expect(existsSync(captureLogPath(root))).toBe(false);
  });

  it('appends one JSONL line per call when enabled', () => {
    const env = { [TELEMETRY_ENV]: '1' };
    appendCaptureRecord(root, record({ isNewLesson: true }), env);
    appendCaptureRecord(root, record({ isNewLesson: false }), env);
    const rows = readCaptureLog(root);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.isNewLesson).toBe(true);
    expect(rows[1]!.isNewLesson).toBe(false);
  });

  it('captureLogExists distinguishes absent from present', () => {
    expect(captureLogExists(root)).toBe(false);
    appendCaptureRecord(root, record(), { [TELEMETRY_ENV]: '1' });
    expect(captureLogExists(root)).toBe(true);
  });

  it('serializes presence/count fields only — never rule text', () => {
    appendCaptureRecord(root, record(), { [TELEMETRY_ENV]: '1' });
    const parsed = JSON.parse(readFileSync(captureLogPath(root), 'utf8').trim());
    expect(Object.keys(parsed).sort()).toEqual(
      ['blocked', 'isNewLesson', 'isNewTopic', 'newTriggerCount', 'triggerKinds', 'ts', 'warningCodes'].sort(),
    );
  });
});

describe('recordCapture', () => {
  const env = { [TELEMETRY_ENV]: '1' };

  it('is a no-op when telemetry is disabled', () => {
    recordCapture(
      root,
      { file: 1, command: 0, keyword: 0 },
      { id: 'L', isNewLesson: true, isNewTopic: false, newTriggerIds: ['t1'], warnings: [] },
      {},
    );
    expect(captureLogExists(root)).toBe(false);
  });

  it('records a successful capture from the AddLessonResult', () => {
    recordCapture(
      root,
      { file: 1, command: 0, keyword: 1 },
      {
        id: 'L',
        isNewLesson: true,
        isNewTopic: true,
        newTriggerIds: ['t1', 't2'],
        warnings: [{ code: 'BROAD_GLOB_TRIGGER', message: 'm' }],
      },
      env,
    );
    const rows = readCaptureLog(root);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      isNewLesson: true,
      isNewTopic: true,
      newTriggerCount: 2,
      triggerKinds: { file: 1, command: 0, keyword: 1 },
      blocked: false,
      warningCodes: ['BROAD_GLOB_TRIGGER'],
      lessonId: 'L',
    });
  });

  it('records a blocked capture (result null) with blocked:true and no lessonId', () => {
    recordCapture(root, { file: 0, command: 0, keyword: 1 }, null, env);
    const rows = readCaptureLog(root);
    expect(rows[0]).toMatchObject({
      blocked: true,
      isNewLesson: false,
      isNewTopic: false,
      newTriggerCount: 0,
      triggerKinds: { file: 0, command: 0, keyword: 1 },
      warningCodes: [],
    });
    expect(rows[0]!.lessonId).toBeUndefined();
  });

  it('stamps the session correlator when AGENTSMESH_SESSION_ID is set', () => {
    recordCapture(root, { file: 1, command: 0, keyword: 0 }, null, {
      [TELEMETRY_ENV]: '1',
      [SESSION_ENV]: 'sess-1',
    });
    expect(readCaptureLog(root)[0]!.session).toBe('sess-1');
  });
});
