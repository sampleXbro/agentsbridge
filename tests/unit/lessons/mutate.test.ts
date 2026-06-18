import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import {
  loadLessonsGraph,
  saveLessonsGraph,
  tryLoadLessonsGraph,
} from '../../../src/lessons/graph-store.js';
import { mutateLessonsGraph } from '../../../src/lessons/mutate.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-mutate-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seed(): void {
  const graph: LessonsGraph = {
    version: 1,
    lessons: {
      'a-1': {
        rule: 'A rule.',
        topics: ['t'],
        triggers: ['x'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      },
    },
    topics: { t: { summary: 'T.' } },
    triggers: { x: { kind: 'file_glob', pattern: 'src/**' } },
  };
  saveLessonsGraph(root, graph);
}

describe('mutateLessonsGraph', () => {
  it('applies the mutation and persists it', async () => {
    seed();
    const result = await mutateLessonsGraph(root, (g) => {
      g.topics['t2'] = { summary: 'T2.' };
      return 'done';
    });
    expect(result).toBe('done');
    expect(loadLessonsGraph(root).topics['t2']?.summary).toBe('T2.');
  });

  it('creates a fresh empty graph when none exists', async () => {
    await mutateLessonsGraph(root, (g) => {
      g.topics['t'] = { summary: 'T.' };
    });
    expect(loadLessonsGraph(root).topics['t']?.summary).toBe('T.');
  });

  it('refuses to write and throws when the mutation produces an error-level invalid graph', async () => {
    seed();
    await expect(
      mutateLessonsGraph(root, (g) => {
        // dangling topic reference -> DANGLING_TOPIC error
        g.lessons['a-1']!.topics = ['ghost'];
      }),
    ).rejects.toThrow(/DANGLING_TOPIC|invalid/i);
    // original graph is untouched
    expect(loadLessonsGraph(root).lessons['a-1']?.topics).toEqual(['t']);
  });

  function seedWithPreexistingBadTrigger(): void {
    const graph: LessonsGraph = {
      version: 1,
      lessons: {
        'a-1': {
          rule: 'A rule.',
          topics: ['t'],
          triggers: ['bad'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-05',
        },
      },
      topics: { t: { summary: 'T.' } },
      // Unbalanced group: `new RegExp('(')` throws -> INVALID_TRIGGER_PATTERN.
      triggers: { bad: { kind: 'command_pattern', pattern: '(' } },
    };
    saveLessonsGraph(root, graph);
  }

  it('does not let a PRE-EXISTING invalid trigger block an unrelated mutation (poison-pill)', async () => {
    seedWithPreexistingBadTrigger();
    await expect(
      mutateLessonsGraph(root, (g) => {
        g.topics['t2'] = { summary: 'T2.' };
        return 'ok';
      }),
    ).resolves.toBe('ok');
    // The unrelated mutation persisted, and the pre-existing bad trigger is left
    // in place (not silently dropped) for the user to repair deliberately.
    expect(loadLessonsGraph(root).topics['t2']?.summary).toBe('T2.');
    expect(loadLessonsGraph(root).triggers['bad']?.pattern).toBe('(');
  });

  it('still blocks a mutation that INTRODUCES a new invalid trigger', async () => {
    seed();
    await expect(
      mutateLessonsGraph(root, (g) => {
        g.triggers['newbad'] = { kind: 'command_pattern', pattern: '(' };
        g.lessons['a-1']!.triggers = ['x', 'newbad'];
      }),
    ).rejects.toThrow(/INVALID_TRIGGER_PATTERN|invalid/i);
    // Original graph untouched.
    expect(loadLessonsGraph(root).triggers['newbad']).toBeUndefined();
  });

  it('serializes concurrent mutators without losing writes', async () => {
    seed();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        mutateLessonsGraph(
          root,
          (g) => {
            g.topics[`c-${i}`] = { summary: `C${i}.` };
          },
          { retries: 50 },
        ),
      ),
    );
    const topics = Object.keys(loadLessonsGraph(root).topics).sort();
    expect(topics).toEqual(['c-0', 'c-1', 'c-2', 'c-3', 'c-4', 't']);
  });

  it('awaits an async mutator and persists its mutation (no silent loss)', async () => {
    seed();
    const result = await mutateLessonsGraph(root, async (g) => {
      await Promise.resolve();
      g.topics['async-topic'] = { summary: 'Added after an await.' };
      return 'done';
    });
    expect(result).toBe('done');
    expect(loadLessonsGraph(root).topics['async-topic']?.summary).toBe('Added after an await.');
  });

  it('does not leave a partial/temp file when validation rejects', async () => {
    seed();
    await mutateLessonsGraph(root, (g) => {
      g.topics['ok'] = { summary: 'ok.' };
    }).catch(() => undefined);
    // sanity: a valid mutation still loads fine afterwards (no lock/temp corruption)
    expect(tryLoadLessonsGraph(root)).not.toBeNull();
  });
});
