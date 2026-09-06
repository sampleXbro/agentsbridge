import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendRecallRecord,
  capRecallLog,
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

describe('isTelemetryEnabled: project config', () => {
  const writeConfig = (body: string): void => {
    mkdirSync(join(root, '.agentsmesh', 'lessons'), { recursive: true });
    writeFileSync(join(root, '.agentsmesh', 'lessons', 'config.json'), body, 'utf8');
  };

  // A hook spawned by a desktop app inherits none of the user's shell exports, so
  // an env-only gate left every hook blind while the CLI in a terminal kept logging.
  it('is on when config.json opts in and the env says nothing', () => {
    writeConfig('{ "telemetry": true }');
    expect(isTelemetryEnabled({}, root)).toBe(true);
  });

  it('stays off without a config, with telemetry false, or with a broken file', () => {
    expect(isTelemetryEnabled({}, root)).toBe(false);
    writeConfig('{ "telemetry": false }');
    expect(isTelemetryEnabled({}, root)).toBe(false);
    writeConfig('{ not json');
    expect(isTelemetryEnabled({}, root)).toBe(false);
    writeConfig('{ "telemetry": "yes" }');
    expect(isTelemetryEnabled({}, root)).toBe(false);
  });

  it('lets the env override the config in both directions', () => {
    writeConfig('{ "telemetry": true }');
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: '0' }, root)).toBe(false);
    writeConfig('{ "telemetry": false }');
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: '1' }, root)).toBe(true);
  });

  it('gates the recall log writer through the config too', () => {
    writeConfig('{ "telemetry": true }');
    appendRecallRecord(root, record(), {});
    expect(readRecallLog(root)).toHaveLength(1);
  });
});

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

describe('capRecallLog', () => {
  const env = { [TELEMETRY_ENV]: '1' };

  it('is a no-op when the log is absent', () => {
    expect(() => capRecallLog(root, 5)).not.toThrow();
    expect(existsSync(recallLogPath(root))).toBe(false);
  });

  it('keeps the file intact when under the record cap', () => {
    for (let i = 0; i < 3; i++) appendRecallRecord(root, record({ totalMatches: i }), env);
    capRecallLog(root, 5);
    expect(readRecallLog(root)).toHaveLength(3);
  });

  it('truncates to the last N records when over the cap', () => {
    for (let i = 0; i < 10; i++) appendRecallRecord(root, record({ totalMatches: i }), env);
    capRecallLog(root, 4);
    const rows = readRecallLog(root);
    expect(rows).toHaveLength(4);
    // Last-N retained: totalMatches 6,7,8,9 (the four most recent).
    expect(rows.map((r) => r.totalMatches)).toEqual([6, 7, 8, 9]);
  });

  it('leaves no temp file behind after truncation', () => {
    for (let i = 0; i < 10; i++) appendRecallRecord(root, record(), env);
    capRecallLog(root, 4);
    const dir = recallLogPath(root).replace(/recall-log\.jsonl$/, '');
    const leftovers = readFileSync(recallLogPath(root), 'utf8');
    expect(leftovers.endsWith('\n')).toBe(true);
    expect(existsSync(join(dir, 'recall-log.jsonl'))).toBe(true);
  });
});
