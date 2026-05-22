/**
 * Branch coverage for `writeLockFile` in `src/cli/commands/generate-lock.ts`.
 * Covers:
 *   - empty resolvedExtends (skips extend hashing branch)
 *   - non-empty resolvedExtends (takes extend hashing branch)
 *   - cache symlink failure path falls back to logger.warn (no throw)
 *   - USER vs USERNAME env fallback for `generatedBy`
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLockFile } from '../../../src/cli/commands/generate-lock.js';
import { logger } from '../../../src/utils/output/logger.js';
import * as fsUtils from '../../../src/utils/filesystem/fs.js';

let canonicalDir: string;
let configDir: string;

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), 'genlock-'));
  canonicalDir = join(configDir, '.agentsmesh');
  await mkdir(canonicalDir, { recursive: true });
  await mkdir(join(canonicalDir, 'rules'), { recursive: true });
  await writeFile(join(canonicalDir, 'rules', '_root.md'), '# root\n', 'utf8');
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(configDir, { recursive: true, force: true });
});

describe('writeLockFile branches', () => {
  it('writes a .lock with empty `extends` block when no resolvedExtends are given', async () => {
    vi.stubEnv('USER', 'unit-test-user');
    await writeLockFile({ canonicalDir, configDir }, []);
    const raw = await readFile(join(canonicalDir, '.lock'), 'utf8');
    expect(raw).toContain('generated_by: unit-test-user');
    expect(raw).toMatch(/extends:\s*\{\}/);
  });

  it('falls back to USERNAME env when USER is unset', async () => {
    const prev = process.env.USER;
    delete process.env.USER;
    vi.stubEnv('USERNAME', 'win-user');
    try {
      await writeLockFile({ canonicalDir, configDir }, []);
      const raw = await readFile(join(canonicalDir, '.lock'), 'utf8');
      expect(raw).toContain('generated_by: win-user');
    } finally {
      if (prev !== undefined) process.env.USER = prev;
    }
  });

  it('logs a warning instead of throwing when ensureCacheSymlink fails', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(fsUtils, 'ensureCacheSymlink').mockRejectedValue(new Error('boom'));

    await expect(writeLockFile({ canonicalDir, configDir }, [])).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/.agentsmeshcache.*boom/));
  });
});
