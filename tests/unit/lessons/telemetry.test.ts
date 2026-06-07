import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendRecallRecord,
  isTelemetryEnabled,
  readRecallLog,
  recallLogPath,
  TELEMETRY_ENV,
  type RecallTelemetryRecord,
} from '../../../src/lessons/telemetry.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-telemetry-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function record(over: Partial<RecallTelemetryRecord> = {}): RecallTelemetryRecord {
  return {
    ts: '2026-06-07T00:00:00.000Z',
    hasFile: true,
    hasCommand: false,
    hasKeyword: false,
    totalMatches: 3,
    returnedCount: 2,
    returnedTokens: 80,
    truncated: true,
    matchedByKind: { file: 2, command: 0, keyword: 1 },
    ...over,
  };
}

describe('isTelemetryEnabled', () => {
  it('is true only when the env flag is exactly "1"', () => {
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: '1' })).toBe(true);
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: 'true' })).toBe(false);
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: '0' })).toBe(false);
    expect(isTelemetryEnabled({})).toBe(false);
  });
});

describe('appendRecallRecord', () => {
  it('writes nothing when telemetry is disabled (default off)', () => {
    appendRecallRecord(root, record(), {});
    expect(existsSync(recallLogPath(root))).toBe(false);
  });

  it('appends exactly one JSONL line per call when enabled', () => {
    const env = { [TELEMETRY_ENV]: '1' };
    appendRecallRecord(root, record({ totalMatches: 1 }), env);
    appendRecallRecord(root, record({ totalMatches: 0, returnedCount: 0 }), env);
    const lines = readFileSync(recallLogPath(root), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).totalMatches).toBe(1);
    expect(JSON.parse(lines[1]!).returnedCount).toBe(0);
  });

  it('reads nothing back when the log is absent', () => {
    expect(readRecallLog(root)).toEqual([]);
  });

  it('reads valid rows and skips a torn final line (crash mid-append)', () => {
    const env = { [TELEMETRY_ENV]: '1' };
    appendRecallRecord(root, record({ totalMatches: 7 }), env);
    appendFileSync(recallLogPath(root), '{"totalMatches": 9, "trunca', 'utf8'); // torn write
    const rows = readRecallLog(root);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.totalMatches).toBe(7);
  });

  it('serializes only the declared fields — never raw file/command/keyword text', () => {
    const env = { [TELEMETRY_ENV]: '1' };
    appendRecallRecord(root, record(), env);
    const parsed = JSON.parse(readFileSync(recallLogPath(root), 'utf8').trim());
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'hasCommand',
        'hasFile',
        'hasKeyword',
        'matchedByKind',
        'returnedCount',
        'returnedTokens',
        'totalMatches',
        'truncated',
        'ts',
      ].sort(),
    );
  });
});
