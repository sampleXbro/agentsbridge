/**
 * Branch coverage for src/cli/commands/generate-lock.ts:
 * - generatedBy fallback (USER → USERNAME → 'unknown') (line 26).
 * - resolvedExtends empty branch (line 24).
 * - ensureCacheSymlink catch branch with non-Error throw (line 38-39).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import { writeLockFile } from '../../../../src/cli/commands/generate-lock.js';
import * as fsUtils from '../../../../src/utils/filesystem/fs.js';

let canonicalDir = '';
let configDir = '';

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'am-genlock-'));
  canonicalDir = join(configDir, '.agentsmesh');
  mkdirSync(canonicalDir, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(configDir, { recursive: true, force: true });
});

function readLock(): Record<string, unknown> {
  const content = readFileSync(join(canonicalDir, '.lock'), 'utf-8');
  return yamlParse(content) as Record<string, unknown>;
}

describe('writeLockFile — branch coverage', () => {
  it('uses USER env var when set', async () => {
    const prevUser = process.env['USER'];
    const prevUsername = process.env['USERNAME'];
    process.env['USER'] = 'alice';
    delete process.env['USERNAME'];
    try {
      await writeLockFile({ canonicalDir, configDir }, [], {}, false);
      expect(readLock().generated_by).toBe('alice');
    } finally {
      if (prevUser !== undefined) process.env['USER'] = prevUser;
      else delete process.env['USER'];
      if (prevUsername !== undefined) process.env['USERNAME'] = prevUsername;
    }
  });

  it('falls back to USERNAME when USER is undefined', async () => {
    const prevUser = process.env['USER'];
    const prevUsername = process.env['USERNAME'];
    delete process.env['USER'];
    process.env['USERNAME'] = 'bob';
    try {
      await writeLockFile({ canonicalDir, configDir }, [], {}, false);
      expect(readLock().generated_by).toBe('bob');
    } finally {
      if (prevUser !== undefined) process.env['USER'] = prevUser;
      if (prevUsername !== undefined) process.env['USERNAME'] = prevUsername;
      else delete process.env['USERNAME'];
    }
  });

  it('falls back to "unknown" when both USER and USERNAME are undefined', async () => {
    const prevUser = process.env['USER'];
    const prevUsername = process.env['USERNAME'];
    delete process.env['USER'];
    delete process.env['USERNAME'];
    try {
      await writeLockFile({ canonicalDir, configDir }, [], {}, false);
      expect(readLock().generated_by).toBe('unknown');
    } finally {
      if (prevUser !== undefined) process.env['USER'] = prevUser;
      if (prevUsername !== undefined) process.env['USERNAME'] = prevUsername;
    }
  });

  it('catches and warns when ensureCacheSymlink throws a non-Error value (String(e) branch)', async () => {
    vi.spyOn(fsUtils, 'ensureCacheSymlink').mockRejectedValue('plain-string-failure');
    // Should not throw; lock file should still be written.
    await writeLockFile({ canonicalDir, configDir }, [], {}, false);
    expect(readLock()).toHaveProperty('lib_version');
  });

  it('catches and warns when ensureCacheSymlink throws an Error', async () => {
    vi.spyOn(fsUtils, 'ensureCacheSymlink').mockRejectedValue(new Error('symlink boom'));
    await writeLockFile({ canonicalDir, configDir }, [], {}, false);
    expect(readLock()).toHaveProperty('lib_version');
  });
});
