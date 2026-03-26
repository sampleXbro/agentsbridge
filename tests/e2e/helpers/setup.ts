/**
 * E2E helper: create temp project dirs and copy fixtures.
 */

import { mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'e2e', 'fixtures');

/**
 * Create a random temp dir for testing. Optionally copy a fixture into it.
 * @param fixtureName - Optional fixture name (e.g. "claude-code-project", "canonical-full")
 * @returns Absolute path to the temp dir
 */
export function createTestProject(fixtureName?: string): string {
  const dir = join(tmpdir(), 'am-e2e-' + randomBytes(8).toString('hex'));
  mkdirSync(dir, { recursive: true });

  if (fixtureName) {
    const src = join(FIXTURES_DIR, fixtureName);
    if (!existsSync(src)) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`Fixture not found: ${src}`);
    }
    cpSync(src, dir, { recursive: true });
  }

  return dir;
}

/**
 * Remove a directory recursively.
 * @param dir - Absolute path to remove
 */
export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
