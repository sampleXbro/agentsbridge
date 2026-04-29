import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLockSync } from '../../../../src/core/check/lock-sync.js';
import { writeLock, buildChecksums } from '../../../../src/config/core/lock.js';
import { loadConfigFromDir } from '../../../../src/config/core/loader.js';

let testDir = '';
beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'amesh-locksync-extra-'));
});
afterEach(() => {
  if (testDir) rmSync(testDir, { recursive: true, force: true });
  testDir = '';
});

describe('checkLockSync — uncovered branches', () => {
  it('marks inSync=true when extends and canonical agree', async () => {
    const projectRoot = join(testDir, 'proj');
    const canonicalDir = join(projectRoot, '.agentsmesh');
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\ntargets: []\n');
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# rules');

    // Build current checksums and write the lock with matching values
    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: {},
    });

    const { config } = await loadConfigFromDir(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.hasLock).toBe(true);
    expect(report.inSync).toBe(true);
    expect(report.modified).toEqual([]);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.extendsModified).toEqual([]);
    expect(report.lockedViolations).toEqual([]);
  });

  it('uses [] fallback when collaboration.lock_features is undefined', async () => {
    const projectRoot = join(testDir, 'no-collab');
    const canonicalDir = join(projectRoot, '.agentsmesh');
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    // Config without `collaboration` block — `lock_features ?? []` falls back to []
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\ntargets: []\n');
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# rules');

    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: {},
    });

    const { config } = await loadConfigFromDir(projectRoot);
    // Loaded config may default lock_features to [] or leave it undefined.
    expect(config.collaboration?.lock_features ?? []).toEqual([]);

    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });
    expect(report.lockedViolations).toEqual([]);
  });
});
