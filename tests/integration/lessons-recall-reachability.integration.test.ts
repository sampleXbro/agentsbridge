import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../src/lessons/graph-store.js';
import { recallLessons } from '../../src/lessons/recall.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-reach-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A keyword-only conceptual lesson — no file/command trigger at all. */
const graph: LessonsGraph = {
  version: 1,
  lessons: {
    conceptual: {
      rule: 'When spawning a subagent, pass a fresh fork_context.',
      topics: ['t'],
      triggers: ['t-kw'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: { 't-kw': { kind: 'keyword', pattern: 'fork_context' } },
};

describe('recall reachability — keyword-only lessons on mandatory --file/--cmd', () => {
  it('surfaces a keyword-only lesson on a file-only recall (no --keyword)', async () => {
    saveLessonsGraph(root, graph);
    const { lessons } = await recallLessons(root, { file: 'src/agents/fork-context-pool.ts' });
    expect(lessons.map((l) => l.id)).toContain('conceptual');
  });

  it('surfaces a keyword-only lesson on a command-only recall (no --keyword)', async () => {
    saveLessonsGraph(root, graph);
    const { lessons } = await recallLessons(root, {
      command: 'spawn worker with fork_context reset',
    });
    expect(lessons.map((l) => l.id)).toContain('conceptual');
  });

  it('does not surface it on an unrelated file (token-boundary match)', async () => {
    saveLessonsGraph(root, graph);
    const { lessons } = await recallLessons(root, { file: 'src/lessons/ranking.ts' });
    expect(lessons.map((l) => l.id)).not.toContain('conceptual');
  });
});
