import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doQuery } from '../../../../src/cli/commands/lessons-handlers.js';
import type { LessonsGraph } from '../../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../../src/lessons/graph-store.js';
import { readRecallLog, recallLogExists, TELEMETRY_ENV } from '../../../../src/lessons/telemetry.js';

/**
 * Parity guard: the CLI `lessons query` path must record recall telemetry just
 * like the MCP `lessons_query` tool. Without it, `AGENTSMESH_LESSONS_TELEMETRY=1`
 * + `lessons query` writes nothing and `lessons stats` reports "no telemetry yet".
 */

let root: string;
let prev: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-query-telemetry-'));
  prev = process.env[TELEMETRY_ENV];
});

afterEach(() => {
  if (prev === undefined) delete process.env[TELEMETRY_ENV];
  else process.env[TELEMETRY_ENV] = prev;
  rmSync(root, { recursive: true, force: true });
});

const graph: LessonsGraph = {
  version: 1,
  lessons: {
    f: {
      rule: 'File-triggered rule.',
      topics: ['t'],
      triggers: ['t-file'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: { 't-file': { kind: 'file_glob', pattern: 'src/**' } },
};

describe('doQuery telemetry', () => {
  it('records one recall record when telemetry is enabled', () => {
    process.env[TELEMETRY_ENV] = '1';
    saveLessonsGraph(root, graph);

    doQuery({ file: 'src/foo.ts' }, root, false);

    expect(recallLogExists(root)).toBe(true);
    const rows = readRecallLog(root);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      hasFile: true,
      hasCommand: false,
      hasKeyword: false,
      totalMatches: 1,
      returnedCount: 1,
      truncated: false,
      matchedByKind: { file: 1, command: 0, keyword: 0 },
    });
  });

  it('writes nothing when telemetry is disabled', () => {
    delete process.env[TELEMETRY_ENV];
    saveLessonsGraph(root, graph);

    doQuery({ file: 'src/foo.ts' }, root, false);

    expect(recallLogExists(root)).toBe(false);
  });

  it('writes nothing when there is no lessons graph', () => {
    process.env[TELEMETRY_ENV] = '1';

    doQuery({ file: 'src/foo.ts' }, root, false);

    expect(recallLogExists(root)).toBe(false);
  });
});
