import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { maybeAutoMigrateLessons } from '../../../src/lessons/auto-migrate.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';

const LEGACY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/lessons/legacy-input',
);
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-automig-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('maybeAutoMigrateLessons', () => {
  it('returns false (no-op) when a graph already exists', async () => {
    saveLessonsGraph(root, { version: 1, lessons: {}, topics: {}, triggers: {} });
    expect(await maybeAutoMigrateLessons(root)).toBe(false);
  });

  it('returns false when there is no legacy index and no graph', async () => {
    expect(await maybeAutoMigrateLessons(root)).toBe(false);
  });

  it('migrates and returns true when a legacy index exists and no graph does', async () => {
    cpSync(LEGACY, join(root, '.agentsmesh/lessons'), { recursive: true });
    expect(await maybeAutoMigrateLessons(root)).toBe(true);
    expect(existsSync(join(root, '.agentsmesh/lessons/lessons.json'))).toBe(true);
    expect(existsSync(join(root, '.agentsmesh/lessons/index.yaml'))).toBe(false);
  });

  it('rethrows a non-existence migration error (e.g. malformed legacy index)', async () => {
    mkdirSync(join(root, '.agentsmesh/lessons'), { recursive: true });
    writeFileSync(
      join(root, '.agentsmesh/lessons/index.yaml'),
      'version: 2\nclusters: []\n',
      'utf8',
    );
    await expect(maybeAutoMigrateLessons(root)).rejects.toThrow();
  });
});
