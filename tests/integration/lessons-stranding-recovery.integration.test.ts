/**
 * Integration: recovering a STRANDED lessons state — a legacy `index.yaml`
 * coexisting with a populated `lessons.json` (an old binary could create this).
 * `importLegacyLessons({ merge: true })` folds the legacy lessons into the
 * existing graph without data loss; `stripMarkersInGraph` migrates a legacy-only
 * store instead of silently ignoring it.
 */

import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importLegacyLessons } from '../../src/lessons/import-legacy.js';
import { captureLesson, recallLessons } from '../../src/lessons/recall.js';
import { stripMarkersInGraph } from '../../src/lessons/strip-markers.js';
import { tryLoadLessonsGraph } from '../../src/lessons/graph-store.js';
import { lessonsPaths } from '../../src/lessons/paths.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/lessons/legacy-input');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-lessons-strand-'));
});

afterEach(() => {
  if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

const stageLegacy = (): void => {
  cpSync(FIXTURE, join(root, '.agentsmesh', 'lessons'), { recursive: true });
};

describe('importLegacyLessons merge recovery', () => {
  it('folds legacy lessons into a populated graph without losing graph data', async () => {
    // 1. A populated graph (a lesson captured after the strand happened).
    await captureLesson(
      root,
      {
        rule: 'Keep this graph-only lesson',
        topic: 'graph-topic',
        triggers: { keywords: ['graphkw'] },
      },
      { allowNewTopic: true, topicSummary: 'Graph topic' },
    );
    // 2. A legacy store now coexists (the stranded state).
    stageLegacy();
    expect(existsSync(lessonsPaths(root).index)).toBe(true);

    // 3. Merge-recover: fold legacy in, keep the graph lesson, delete legacy.
    const report = await importLegacyLessons(root, { migratedAt: '2026-06-06', merge: true });
    expect(report.lessonCount).toBeGreaterThan(0); // net-new legacy lessons added
    expect(existsSync(lessonsPaths(root).index)).toBe(false);

    const graph = tryLoadLessonsGraph(root);
    expect(graph).not.toBeNull();
    // The original graph lesson survives...
    expect(graph!.lessons['graph-topic-keep-this-graph-only-lesson']).toBeDefined();
    // ...and the legacy lessons are now recalled too.
    const fromGraph = await recallLessons(root, { keyword: 'graphkw' }, { maxTokens: null });
    const fromLegacy = await recallLessons(root, { keyword: 'alpha' }, { maxTokens: null });
    expect(fromGraph.totalMatches).toBeGreaterThan(0);
    expect(fromLegacy.totalMatches).toBeGreaterThan(0);
  });

  it('merge is idempotent — re-running adds nothing new', async () => {
    stageLegacy();
    await importLegacyLessons(root, { migratedAt: '2026-06-06', merge: true });
    const before = tryLoadLessonsGraph(root)!;
    const beforeCount = Object.keys(before.lessons).length;

    // Re-stage legacy and merge again — every lesson dedups by rule text.
    stageLegacy();
    const second = await importLegacyLessons(root, { migratedAt: '2026-06-06', merge: true });
    expect(second.lessonCount).toBe(0); // nothing net-new
    expect(Object.keys(tryLoadLessonsGraph(root)!.lessons).length).toBe(beforeCount);
  });
});

describe('stripMarkersInGraph on a legacy-only store', () => {
  it('migrates the legacy store first instead of silently ignoring it', async () => {
    stageLegacy();
    expect(tryLoadLessonsGraph(root)).toBeNull(); // no graph yet, only legacy

    const report = await stripMarkersInGraph(root);
    expect(report.changedCount).toBeGreaterThanOrEqual(0); // ran (did not silently no-op a legacy store)
    // The legacy store was migrated as part of the operation.
    expect(existsSync(lessonsPaths(root).graph)).toBe(true);
    expect(existsSync(lessonsPaths(root).index)).toBe(false);
    expect(Object.keys(tryLoadLessonsGraph(root)!.lessons).length).toBeGreaterThan(0);
  });

  it('is a clean no-op when neither graph nor legacy store exists', async () => {
    const report = await stripMarkersInGraph(root);
    expect(report).toEqual({ changedIds: [], changedCount: 0 });
    expect(existsSync(lessonsPaths(root).graph)).toBe(false);
  });
});
