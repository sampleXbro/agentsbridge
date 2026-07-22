import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { graphFilePath } from '../../../src/lessons/graph-store.js';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { recallLessons } from '../../../src/lessons/recall.js';
import { readRecallLog } from '../../../src/lessons/telemetry.js';

const GRAPH: LessonsGraph = {
  version: 2,
  topics: { t: { summary: 't' } },
  triggers: { 'glob-src': { kind: 'file_glob', pattern: 'src/**' } },
  lessons: {
    l1: {
      rule: 'edit src carefully',
      topics: ['t'],
      triggers: ['glob-src'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
    },
  },
};

let root: string;
let prevTel: string | undefined;
let prevSession: string | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-recall-session-'));
  const p = graphFilePath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(GRAPH), 'utf8');
  prevTel = process.env.AGENTSMESH_LESSONS_TELEMETRY;
  process.env.AGENTSMESH_LESSONS_TELEMETRY = '1';
  prevSession = process.env.AGENTSMESH_SESSION_ID;
  delete process.env.AGENTSMESH_SESSION_ID;
});
afterEach(() => {
  if (prevTel === undefined) delete process.env.AGENTSMESH_LESSONS_TELEMETRY;
  else process.env.AGENTSMESH_LESSONS_TELEMETRY = prevTel;
  if (prevSession !== undefined) process.env.AGENTSMESH_SESSION_ID = prevSession;
  rmSync(root, { recursive: true, force: true });
});

describe('recall telemetry session threading', () => {
  it('stamps the caller-supplied session id on the recall-telemetry record', async () => {
    const result = await recallLessons(root, { file: 'src/x.ts' }, { sessionId: 'rs1' });
    expect(result.lessons.map((l) => l.id)).toEqual(['l1']);
    const recs = readRecallLog(root);
    expect(recs.length).toBe(1);
    expect(recs[0]!.session).toBe('rs1');
  });

  it('falls back to the env session when no explicit id is passed', async () => {
    process.env.AGENTSMESH_SESSION_ID = 'env-s';
    await recallLessons(root, { file: 'src/x.ts' }, {});
    expect(readRecallLog(root)[0]!.session).toBe('env-s');
  });
});
