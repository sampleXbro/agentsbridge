import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendJsonl, capJsonl, logExists, readJsonl } from '../../../src/lessons/jsonl-log.js';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-jsonl-'));
  path = join(dir, 'nested', 'log.jsonl');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const opts = { maxRecords: 5, trimTriggerBytes: 2_000_000 };

describe('appendJsonl', () => {
  it('creates the parent directory and appends one JSON line per call', () => {
    appendJsonl(path, { n: 1 }, opts);
    appendJsonl(path, { n: 2 }, opts);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).n).toBe(1);
    expect(JSON.parse(lines[1]!).n).toBe(2);
  });

  it('truncates to the last maxRecords once the byte trigger is crossed', () => {
    // A tiny byte trigger forces a trim check on every append.
    const tight = { maxRecords: 3, trimTriggerBytes: 1 };
    for (let i = 0; i < 10; i++) appendJsonl(path, { n: i }, tight);
    const rows = readJsonl<{ n: number }>(path);
    expect(rows.map((r) => r.n)).toEqual([7, 8, 9]);
  });
});

describe('readJsonl', () => {
  it('returns [] when the log is absent', () => {
    expect(readJsonl(path)).toEqual([]);
  });

  it('reads valid rows and skips a torn final line (crash mid-append)', () => {
    appendJsonl(path, { n: 7 }, opts);
    appendFileSync(path, '{"n": 9, "trunca', 'utf8');
    const rows = readJsonl<{ n: number }>(path);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.n).toBe(7);
  });
});

describe('capJsonl', () => {
  it('is a no-op when the log is absent', () => {
    expect(() => capJsonl(path, 5)).not.toThrow();
    expect(existsSync(path)).toBe(false);
  });

  it('keeps the file intact when under the record cap', () => {
    for (let i = 0; i < 3; i++) appendJsonl(path, { n: i }, opts);
    capJsonl(path, 5);
    expect(readJsonl(path)).toHaveLength(3);
  });

  it('truncates to the last N records and leaves a trailing newline, no temp file', () => {
    for (let i = 0; i < 10; i++) appendJsonl(path, { n: i }, opts);
    capJsonl(path, 4);
    const rows = readJsonl<{ n: number }>(path);
    expect(rows.map((r) => r.n)).toEqual([6, 7, 8, 9]);
    expect(readFileSync(path, 'utf8').endsWith('\n')).toBe(true);
    expect(existsSync(`${path}.${process.pid}.tmp`)).toBe(false);
  });
});

describe('logExists', () => {
  it('distinguishes an absent log from a present one', () => {
    expect(logExists(path)).toBe(false);
    appendJsonl(path, { n: 1 }, opts);
    expect(logExists(path)).toBe(true);
  });
});
