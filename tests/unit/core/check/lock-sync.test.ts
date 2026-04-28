/**
 * Senior-QA coverage for `checkLockSync` — the pure drift detector behind
 * `agentsmesh check` and the public `check()` API. Each test pins one branch
 * or one team-workflow scenario the existing suite did not cover.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkLockSync } from '../../../../src/core/check/lock-sync.js';
import { writeLock, buildChecksums } from '../../../../src/config/core/lock.js';
import { loadConfigFromDir } from '../../../../src/config/core/loader.js';
import { hashContent } from '../../../../src/utils/crypto/hash.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

const TEST_DIR = join(tmpdir(), `am-lock-sync-unit-${process.pid}`);

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

async function loadConfig(projectRoot: string): Promise<ValidatedConfig> {
  return (await loadConfigFromDir(projectRoot)).config;
}

function setupBareProject(yaml: string): { projectRoot: string; canonicalDir: string } {
  const projectRoot = join(TEST_DIR, 'proj');
  const canonicalDir = join(projectRoot, '.agentsmesh');
  mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
  writeFileSync(join(projectRoot, 'agentsmesh.yaml'), yaml);
  return { projectRoot, canonicalDir };
}

describe('checkLockSync', () => {
  it('hasLock=false and inSync=false when .lock is missing — and all drift arrays are empty', async () => {
    const { projectRoot, canonicalDir } = setupBareProject('version: 1\n');
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# Rules');
    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.hasLock).toBe(false);
    expect(report.inSync).toBe(false);
    expect(report.modified).toEqual([]);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.extendsModified).toEqual([]);
    expect(report.lockedViolations).toEqual([]);
  });

  it('reports added + modified + removed + extendsModified all in one report', async () => {
    const baseDir = join(TEST_DIR, 'shared');
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(baseDir, '.agentsmesh', 'rules', '_root.md'), '# Base v2');

    const { projectRoot, canonicalDir } = setupBareProject(
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ../shared
    features: [rules]
`,
    );
    // Modified file: hash differs from lock.
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# Local modified');
    // Added file: present now, not in lock.
    writeFileSync(join(canonicalDir, 'rules', 'added.md'), '# Added');
    // Lock entry for a file that no longer exists → removed.
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums: {
        'rules/_root.md': `sha256:${'a'.repeat(64)}`,
        'rules/removed.md': `sha256:${'b'.repeat(64)}`,
      },
      extends: { base: `local:sha256:${'c'.repeat(64)}` },
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.hasLock).toBe(true);
    expect(report.inSync).toBe(false);
    expect(report.modified).toEqual(['rules/_root.md']);
    expect(report.added).toEqual(['rules/added.md']);
    expect(report.removed).toEqual(['rules/removed.md']);
    expect(report.extendsModified).toEqual(['base']);
  });

  it('inSync=true when canonical, extends, and lock all match exactly', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const body = '# Rules';
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), body);
    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: {},
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.hasLock).toBe(true);
    expect(report.inSync).toBe(true);
    expect(report.modified).toEqual([]);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.extendsModified).toEqual([]);
    expect(report.lockedViolations).toEqual([]);
    // Exercise the hashContent helper to assert checksum format used in lock.
    expect(checksums['rules/_root.md']).toBe(`sha256:${hashContent(body)}`);
  });

  it('lockedViolations only flags drift inside configured lock_features', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      `version: 1
targets: [claude-code]
features: [rules, mcp]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# changed-rules');
    writeFileSync(join(canonicalDir, 'mcp.json'), '{"changed":"mcp"}');
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums: {
        'rules/_root.md': `sha256:${'0'.repeat(64)}`,
        'mcp.json': `sha256:${'1'.repeat(64)}`,
      },
      extends: {},
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.modified.sort()).toEqual(['mcp.json', 'rules/_root.md']);
    // mcp.json drifted but is NOT in lock_features.
    expect(report.lockedViolations).toEqual(['rules/_root.md']);
  });

  it('lock_features containing unknown feature names are silently ignored (no false positives)', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [definitely-not-a-feature, also_bogus]
`,
    );
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# new');
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums: { 'rules/_root.md': `sha256:${'0'.repeat(64)}` },
      extends: {},
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.inSync).toBe(false);
    expect(report.modified).toEqual(['rules/_root.md']);
    // Unknown feature name → no matcher → no violations even though file drifted.
    expect(report.lockedViolations).toEqual([]);
  });

  it('lock_features can flag added or removed files (not just modified)', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      `version: 1
targets: [claude-code]
features: [rules, hooks, permissions]
collaboration:
  strategy: lock
  lock_features: [hooks, permissions]
`,
    );
    // hooks.yaml present in lock but removed from canonical.
    // permissions.yaml present in canonical but absent from lock.
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# stable');
    writeFileSync(join(canonicalDir, 'permissions.yaml'), 'allow: []');
    const stable = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums: {
        'rules/_root.md': stable['rules/_root.md']!,
        'hooks.yaml': `sha256:${'9'.repeat(64)}`,
      },
      extends: {},
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.added).toEqual(['permissions.yaml']);
    expect(report.removed).toEqual(['hooks.yaml']);
    expect(report.lockedViolations.sort()).toEqual(['hooks.yaml', 'permissions.yaml']);
    expect(report.modified).toEqual([]);
  });

  it('extendsModified=[] when no extends configured (does not affect inSync)', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# stable');
    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: {}, // no extends in lock
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.extendsModified).toEqual([]);
    expect(report.inSync).toBe(true);
  });

  it('detects extend that is in lock but no longer resolves (extend removed from config)', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# stable');
    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: { 'orphan-extend': `local:sha256:${'a'.repeat(64)}` },
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.extendsModified).toEqual(['orphan-extend']);
    expect(report.inSync).toBe(false);
  });

  it('packs/ files are NOT included in canonical checksums (tracked separately in lock.packs)', async () => {
    const { projectRoot, canonicalDir } = setupBareProject(
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    writeFileSync(join(canonicalDir, 'rules', '_root.md'), '# stable');
    // Create a pack folder with would-be canonical-shaped files.
    mkdirSync(join(canonicalDir, 'packs', 'pack-one', 'rules'), { recursive: true });
    writeFileSync(join(canonicalDir, 'packs', 'pack-one', 'rules', 'pack-rule.md'), '# pack rule');

    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-01T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.1.0',
      checksums,
      extends: {},
      packs: {},
    });

    const config = await loadConfig(projectRoot);
    const report = await checkLockSync({ config, configDir: projectRoot, canonicalDir });

    expect(report.inSync).toBe(true);
    expect(Object.keys(checksums).some((k) => k.startsWith('packs/'))).toBe(false);
    // Pack drift is intentionally NOT surfaced through `modified/added/removed`.
    expect(report.modified).toEqual([]);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
  });
});
