import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonsGraph } from '../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../src/lessons/graph-store.js';
import { recallLessons } from '../../src/lessons/recall.js';

let root: string;
let counter = 0;
const sessions: string[] = [];
function uniqueSession(): string {
  const id = `dedup-${process.pid}-${counter++}`;
  sessions.push(id);
  return id;
}

const graph: LessonsGraph = {
  version: 1,
  lessons: {
    a: { rule: 'Rule A.', topics: ['t'], triggers: ['t-glob'], evidence: [], status: 'active', createdAt: '2026-06-05' },
    b: { rule: 'Rule B.', topics: ['t'], triggers: ['t-glob'], evidence: [], status: 'active', createdAt: '2026-06-05' },
  },
  topics: { t: { summary: 'T.' } },
  triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/**' } },
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-dedup-'));
  saveLessonsGraph(root, graph);
  // Hermetic: no ambient telemetry / session correlator leaking into recall.
  vi.stubEnv('AGENTSMESH_LESSONS_TELEMETRY', '');
  vi.stubEnv('AGENTSMESH_SESSION_ID', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
  for (const id of sessions.splice(0)) {
    rmSync(join(tmpdir(), 'agentsmesh-lessons-seen', `${id}.json`), { force: true });
  }
});

describe('recallLessons session dedup', () => {
  it('returns everything on the first recall, then suppresses repeats on the next', async () => {
    const sessionId = uniqueSession();
    const first = await recallLessons(root, { file: 'src/x.ts' }, { sessionId });
    expect(first.lessons.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(first.suppressed).toBe(0);

    const second = await recallLessons(root, { file: 'src/x.ts' }, { sessionId });
    expect(second.lessons).toEqual([]);
    expect(second.totalMatches).toBe(2);
    expect(second.suppressed).toBe(2);
  });

  it('--no-dedup returns the full set even after they were delivered', async () => {
    const sessionId = uniqueSession();
    await recallLessons(root, { file: 'src/x.ts' }, { sessionId });
    const again = await recallLessons(root, { file: 'src/x.ts' }, { sessionId, noDedup: true });
    expect(again.lessons.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(again.suppressed).toBe(0);
  });

  it('a different session starts fresh', async () => {
    await recallLessons(root, { file: 'src/x.ts' }, { sessionId: uniqueSession() });
    const other = await recallLessons(root, { file: 'src/x.ts' }, { sessionId: uniqueSession() });
    expect(other.lessons.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('with no session correlator, recall is fully stateless (no suppression)', async () => {
    const r1 = await recallLessons(root, { file: 'src/x.ts' });
    const r2 = await recallLessons(root, { file: 'src/x.ts' });
    expect(r1.lessons.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(r2.lessons.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(r2.suppressed).toBe(0);
  });
});
