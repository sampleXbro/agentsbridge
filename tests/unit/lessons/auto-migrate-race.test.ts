import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Simulate the race where a concurrent writer creates the graph between our
// existence check and the lock: importLegacyLessons throws LessonsGraphExistsError.
vi.mock('../../../src/lessons/import-legacy.js', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/lessons/import-legacy.js')>();
  return {
    ...actual,
    importLegacyLessons: vi.fn(async () => {
      throw new actual.LessonsGraphExistsError();
    }),
  };
});

const { maybeAutoMigrateLessons } = await import('../../../src/lessons/auto-migrate.js');

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-automig-race-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('maybeAutoMigrateLessons — concurrent-create race', () => {
  it('returns false (no clobber) when migration reports the graph already exists', async () => {
    mkdirSync(join(root, '.agentsmesh/lessons'), { recursive: true });
    writeFileSync(
      join(root, '.agentsmesh/lessons/index.yaml'),
      'version: 1\nclusters: []\n',
      'utf8',
    );
    expect(await maybeAutoMigrateLessons(root)).toBe(false);
  });
});
