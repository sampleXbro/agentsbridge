import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doPrune } from '../../src/cli/commands/lessons-handlers.js';
import type { LessonsPruneData } from '../../src/cli/commands/lessons-types.js';
import { loadLessonsGraph, saveLessonsGraph } from '../../src/lessons/graph-store.js';
import type { LessonsGraph } from '../../src/lessons/graph-schema.js';
import { validateLessonsGraph } from '../../src/lessons/validate.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-prune-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** An over-cap active lesson (10 triggers) plus a trigger only a superseded lesson uses. */
function seed(): void {
  const triggers: LessonsGraph['triggers'] = {
    't-dead': { kind: 'file_glob', pattern: 'src/dead.ts' },
  };
  const bigTriggers: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const id = `tr${i}`;
    triggers[id] = { kind: 'file_glob', pattern: `src/a${i}.ts` };
    bigTriggers.push(id);
  }
  const graph: LessonsGraph = {
    version: 1,
    lessons: {
      big: {
        rule: 'Big rule.',
        topics: ['t'],
        triggers: bigTriggers,
        evidence: [],
        status: 'active',
        createdAt: '2026-06-02',
      },
      sup: {
        rule: 'Old rule.',
        topics: ['t'],
        triggers: ['t-dead'],
        evidence: [],
        status: 'superseded',
        supersededBy: 'big',
        createdAt: '2026-06-01',
      },
    },
    topics: { t: { summary: 'T.' } },
    triggers,
  };
  saveLessonsGraph(root, graph);
}

function pruneData(result: Awaited<ReturnType<typeof doPrune>>): LessonsPruneData {
  if (result.subcommand !== 'prune') throw new Error('expected prune result');
  return result.data;
}

describe('lessons prune (command)', () => {
  it('dry run reports the plan and writes nothing', async () => {
    seed();
    const data = pruneData(await doPrune({}, root));
    expect(data.applied).toBe(false);
    expect(data.cap).toBe(8);
    expect(data.trimmedLessons).toEqual([{ id: 'big', removedCount: 2, keptCount: 8 }]);
    expect(data.removedTriggerIds).toContain('t-dead');

    // On-disk graph is untouched by a dry run.
    expect(loadLessonsGraph(root).lessons.big?.triggers.length).toBe(10);
    expect(loadLessonsGraph(root).triggers['t-dead']).toBeDefined();
  });

  it('--apply curates the graph atomically and leaves it valid', async () => {
    seed();
    const data = pruneData(await doPrune({ apply: true }, root));
    expect(data.applied).toBe(true);

    const graph = loadLessonsGraph(root);
    expect(graph.lessons.big?.triggers.length).toBe(8);
    expect(graph.lessons.sup?.triggers).toEqual([]);
    expect(graph.triggers['t-dead']).toBeUndefined();
    expect(validateLessonsGraph(graph).ok).toBe(true);

    // Idempotent: a second apply finds nothing to do.
    const again = pruneData(await doPrune({ apply: true }, root));
    expect(again.trimmedLessons).toEqual([]);
    expect(again.removedTriggerIds).toEqual([]);
  });

  it('rejects a non-positive --cap', async () => {
    seed();
    const result = await doPrune({ cap: '0' }, root);
    expect(result.exitCode).toBe(2);
    expect(result.error).toMatch(/--cap/);
  });
});
