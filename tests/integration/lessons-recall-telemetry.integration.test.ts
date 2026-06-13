import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../src/lessons/graph-store.js';
import { recallLessons } from '../../src/lessons/recall.js';
import { recallLogPath, TELEMETRY_ENV } from '../../src/lessons/telemetry.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-recall-tel-'));
  saveLessonsGraph(root, graph());
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env[TELEMETRY_ENV];
});

function graph(): LessonsGraph {
  return {
    version: 1,
    lessons: {
      g: {
        rule: 'File rule.',
        topics: ['t'],
        triggers: ['t-glob'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-01',
      },
      k: {
        rule: 'Keyword rule.',
        topics: ['t'],
        triggers: ['t-kw'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-01',
      },
    },
    topics: { t: { summary: 'T.' } },
    triggers: {
      't-glob': { kind: 'file_glob', pattern: 'src/**' },
      't-kw': { kind: 'keyword', pattern: 'windows' },
    },
  };
}

describe('recallLessons telemetry', () => {
  it('writes no log when telemetry is disabled', async () => {
    delete process.env[TELEMETRY_ENV];
    await recallLessons(root, { file: 'src/a.ts' });
    expect(existsSync(recallLogPath(root))).toBe(false);
  });

  it('appends one provenance-tagged record per recall when enabled', async () => {
    process.env[TELEMETRY_ENV] = '1';
    await recallLessons(root, { file: 'src/a.ts' });
    await recallLessons(root, { keyword: 'windows path' });

    const lines = readFileSync(recallLogPath(root), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]!);
    expect(first).toMatchObject({
      hasFile: true,
      hasKeyword: false,
      totalMatches: 1,
      returnedCount: 1,
      matchedByKind: { file: 1, command: 0, keyword: 0 },
    });
    expect(typeof first.ts).toBe('string');

    const second = JSON.parse(lines[1]!);
    expect(second).toMatchObject({
      hasFile: false,
      hasKeyword: true,
      matchedByKind: { file: 0, command: 0, keyword: 1 },
    });
  });
});
