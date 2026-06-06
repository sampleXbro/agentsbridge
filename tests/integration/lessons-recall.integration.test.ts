/**
 * Integration: the migration-aware application APIs `recallLessons` and
 * `captureLesson` (src/lessons/recall.ts).
 *
 * These close the public-API gap the review flagged: the low-level primitives
 * (`tryLoadLessonsGraph`, `mutateLessonsGraph`) do NOT migrate a legacy store,
 * so a first read/write through them would strand `index.yaml`. The blessed
 * application APIs migrate first.
 */

import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureLesson, recallLessons } from '../../src/lessons/recall.js';
import { tryLoadLessonsGraph } from '../../src/lessons/graph-store.js';
import { lessonsPaths } from '../../src/lessons/paths.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/lessons/legacy-input');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-lessons-recall-'));
});

afterEach(() => {
  if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function stageLegacy(): void {
  cpSync(FIXTURE, join(root, '.agentsmesh', 'lessons'), { recursive: true });
}

describe('recallLessons', () => {
  it('migrates a legacy store on first read so it is never stranded', () => {
    stageLegacy();
    // Sanity: the low-level primitive does NOT migrate — it would strand legacy.
    expect(tryLoadLessonsGraph(root)).toBeNull();

    return recallLessons(root, { keyword: 'alpha' }).then((result) => {
      // Legacy index consumed, JSON graph written, lessons recalled.
      expect(existsSync(lessonsPaths(root).index)).toBe(false);
      expect(existsSync(lessonsPaths(root).graph)).toBe(true);
      expect(result.totalMatches).toBeGreaterThan(0);
      expect(result.lessons.length).toBeGreaterThan(0);
    });
  });

  it('returns empty (not an error) when no graph and no legacy store exist', async () => {
    const result = await recallLessons(root, { keyword: 'anything' });
    expect(result).toEqual({ lessons: [], totalMatches: 0 });
  });

  it('applies the default token budget, and maxTokens:null disables it', async () => {
    // Seed many distinct LONG lessons under one shared keyword trigger so the
    // token budget — not the default limit — is what trims the result.
    const filler = `${'word '.repeat(50)}`.trim(); // ~250 chars ≈ ~63 tokens each
    for (let i = 0; i < 20; i++) {
      await captureLesson(
        root,
        {
          rule: `Budget lesson number ${i} ${filler}`,
          topic: 'budget',
          triggers: { keywords: ['budgetkw'] },
        },
        { allowNewTopic: true, topicSummary: 'Budget topic' },
      );
    }
    const def = await recallLessons(root, { keyword: 'budgetkw' });
    const unlimited = await recallLessons(
      root,
      { keyword: 'budgetkw' },
      { maxTokens: null, limit: 100 },
    );
    const tiny = await recallLessons(root, { keyword: 'budgetkw' }, { maxTokens: 80, limit: 100 });
    // An explicit small budget keeps only the top result (each rule > 80 tokens).
    expect(tiny.lessons.length).toBe(1);
    expect(def.totalMatches).toBe(20);
    // Default 400-token budget trims BELOW the default 10-result limit (each
    // long rule costs ~63 tokens, so ~6 fit) — proving the budget, not the limit.
    expect(def.lessons.length).toBeLessThan(10);
    // An explicit null budget (with a high limit) returns the whole match set.
    expect(unlimited.lessons.length).toBe(20);
  });
});

describe('captureLesson', () => {
  it('migrates a legacy store before adding, preserving legacy lessons', async () => {
    stageLegacy();
    const result = await captureLesson(
      root,
      { rule: 'A freshly captured rule', topic: 'alpha-rules', triggers: { keywords: ['fresh'] } },
      {},
    );
    expect(result.isNewLesson).toBe(true);
    expect(existsSync(lessonsPaths(root).index)).toBe(false);

    const graph = tryLoadLessonsGraph(root);
    expect(graph).not.toBeNull();
    // Legacy lessons (migrated) plus the freshly captured one coexist.
    const recalled = await recallLessons(root, { keyword: 'alpha' }, { maxTokens: null });
    expect(recalled.totalMatches).toBeGreaterThan(0);
  });
});
