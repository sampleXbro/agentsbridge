/**
 * Branch coverage for src/core/check/lock-sync.ts:
 * - Iterating over extends present in lock vs current checksums (lines 93-99).
 * - extendsModified true vs false branches.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLockSync } from '../../../../src/core/check/lock-sync.js';
import { writeLock, buildChecksums } from '../../../../src/config/core/lock.js';
import { loadConfigFromDir } from '../../../../src/config/core/loader.js';
import { hashContent } from '../../../../src/utils/crypto/hash.js';

let testDir = '';

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'amesh-locksync-ext-'));
});

afterEach(() => {
  if (testDir) rmSync(testDir, { recursive: true, force: true });
  testDir = '';
});

describe('checkLockSync — extends drift branches', () => {
  it('flags extends drift when lock has an entry that current does not match', async () => {
    const projectRoot = join(testDir, 'proj');
    const canonicalDir = join(projectRoot, '.agentsmesh');
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\ntargets: []\n');
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# r\n');

    const checksums = await buildChecksums(canonicalDir);
    // Lock has an extends entry that doesn't exist in the current config →
    // current extends is {} and the entry's currentExtends[name] is undefined,
    // hitting the "drifted" branch.
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: { 'phantom-extend': 'sha256:abc' },
      packs: {},
    });

    const { config } = await loadConfigFromDir(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.hasLock).toBe(true);
    expect(report.extendsModified).toEqual(['phantom-extend']);
    expect(report.inSync).toBe(false);
  });

  it('reports added canonical files (in current but not in lock)', async () => {
    const projectRoot = join(testDir, 'proj2');
    const canonicalDir = join(projectRoot, '.agentsmesh');
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\ntargets: []\n');
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# r\n');

    // Lock with empty checksums → every canonical file is "added".
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums: {},
      extends: {},
      packs: {},
    });

    const { config } = await loadConfigFromDir(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });
    expect(report.added.length).toBeGreaterThan(0);
    expect(report.inSync).toBe(false);
  });

  it('reports removed canonical files (in lock but not on disk)', async () => {
    const projectRoot = join(testDir, 'proj3');
    const canonicalDir = join(projectRoot, '.agentsmesh');
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\ntargets: []\n');
    // No canonical files on disk, but lock claims rules/ghost.md existed.
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums: { 'rules/ghost.md': 'sha256:abc' },
      extends: {},
      packs: {},
    });

    const { config } = await loadConfigFromDir(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });
    expect(report.removed).toContain('rules/ghost.md');
  });

  it('outputsChecked=true and no output drift when rootBase + matching outputs', async () => {
    const projectRoot = join(testDir, 'proj4');
    const canonicalDir = join(projectRoot, '.agentsmesh');
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\ntargets: []\n');
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# r\n');
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# generated');

    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-07-18T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: {},
      packs: {},
      outputs: {
        'AGENTS.md': `sha256:${hashContent('# generated')}`,
      },
    });

    const { config } = await loadConfigFromDir(projectRoot);
    const report = await checkLockSync({
      config,
      configDir: projectRoot,
      canonicalDir,
      rootBase: projectRoot,
    });

    expect(report.outputsChecked).toBe(true);
    expect(report.outputsModified).toEqual([]);
    expect(report.outputsRemoved).toEqual([]);
    expect(report.inSync).toBe(true);
  });
});
