/**
 * Unit tests for setup helper.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from './setup.js';

describe('createTestProject', () => {
  it('returns existing empty dir when no fixture', () => {
    const dir = createTestProject();
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir)).toHaveLength(0);
    cleanup(dir);
  });

  it('copies fixture contents when fixtureName provided', () => {
    const fixturesDir = join(process.cwd(), 'tests', 'e2e', 'fixtures');
    const fixturePath = join(fixturesDir, 'some-fixture');
    mkdirSync(fixturePath, { recursive: true });
    writeFileSync(join(fixturePath, 'hello.txt'), 'world');
    try {
      const dir = createTestProject('some-fixture');
      expect(existsSync(dir)).toBe(true);
      expect(readFileSync(join(dir, 'hello.txt'), 'utf-8')).toBe('world');
      cleanup(dir);
    } finally {
      rmSync(fixturePath, { recursive: true, force: true });
    }
  });
});

describe('cleanup', () => {
  it('removes the dir', () => {
    const dir = createTestProject();
    expect(existsSync(dir)).toBe(true);
    cleanup(dir);
    expect(existsSync(dir)).toBe(false);
  });
});
