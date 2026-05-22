/**
 * Branch coverage for `shouldImportScopedAgentsRule` and
 * `removePathIfExists` in `src/targets/import/scoped-agents-import.ts`.
 * Covers:
 *   - empty relative dir → false
 *   - dotfile/dotdir segment → false (.github, .well-known, .. etc.)
 *   - tests/e2e/fixtures prefix → false
 *   - normal nested directories → true
 *   - root-level dirs (single segment) → true
 *   - removePathIfExists is a no-op when target is missing and removes when present
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  removePathIfExists,
  shouldImportScopedAgentsRule,
} from '../../../../src/targets/import/scoped-agents-import.js';

describe('shouldImportScopedAgentsRule', () => {
  it('returns false for empty relative dir', () => {
    expect(shouldImportScopedAgentsRule('')).toBe(false);
  });

  it('returns false when any segment starts with a dot', () => {
    expect(shouldImportScopedAgentsRule('.github')).toBe(false);
    expect(shouldImportScopedAgentsRule('src/.hidden/sub')).toBe(false);
    expect(shouldImportScopedAgentsRule('..')).toBe(false);
  });

  it('returns false for paths under tests/e2e/fixtures/', () => {
    expect(shouldImportScopedAgentsRule('tests/e2e/fixtures/foo')).toBe(false);
    expect(shouldImportScopedAgentsRule('tests/e2e/fixtures/deep/nested')).toBe(false);
  });

  it('returns true for ordinary single-segment dirs', () => {
    expect(shouldImportScopedAgentsRule('src')).toBe(true);
  });

  it('returns true for ordinary nested dirs (and does not over-match tests/e2e)', () => {
    expect(shouldImportScopedAgentsRule('src/foo/bar')).toBe(true);
    expect(shouldImportScopedAgentsRule('tests/e2e/specs')).toBe(true);
  });
});

describe('removePathIfExists', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rm-if-exists-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves without throwing when the path does not exist', async () => {
    await expect(removePathIfExists(join(dir, 'does-not-exist.md'))).resolves.toBeUndefined();
  });

  it('removes the file when it exists', async () => {
    const target = join(dir, 'kill-me.md');
    await writeFile(target, 'hi', 'utf8');
    await removePathIfExists(target);
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
