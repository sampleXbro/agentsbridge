import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addLesson } from '../../../src/lessons/add.js';
import { scaffoldLessons } from '../../../src/lessons/init.js';
import { loadLessonsGraph } from '../../../src/lessons/graph-store.js';

const LEGACY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/lessons/legacy-input',
);

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-strand-'));
  // A project upgrading from the legacy store: index.yaml + topics/*.md, no graph.
  cpSync(LEGACY, join(root, '.agentsmesh/lessons'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('public writers do not strand a legacy lessons store', () => {
  it('addLesson migrates the legacy store before capturing (no stranding)', async () => {
    await addLesson(
      root,
      {
        rule: 'A brand new captured rule.',
        topic: 'alpha-rules',
        triggers: { files: ['src/new/**/*.ts'] },
        createdAt: '2026-06-06',
      },
      {},
    );

    const graph = loadLessonsGraph(root);
    // The legacy lessons survived the first capture.
    expect(Object.keys(graph.lessons).length).toBeGreaterThan(1);
    expect(graph.topics['alpha-rules']).toBeDefined();
    expect(graph.topics['beta-rules']).toBeDefined();
    // And our new lesson is present.
    const rules = Object.values(graph.lessons).map((l) => l.rule);
    expect(rules).toContain('A brand new captured rule.');
  });

  it('scaffoldLessons migrates the legacy store instead of creating an empty graph', async () => {
    await scaffoldLessons(root);

    const graph = loadLessonsGraph(root);
    expect(Object.keys(graph.lessons).length).toBeGreaterThan(0);
    expect(graph.topics['alpha-rules']).toBeDefined();
    expect(graph.topics['beta-rules']).toBeDefined();
  });
});
