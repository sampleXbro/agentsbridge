/**
 * Integration: legacy pack auto-migration on uninstall.
 *
 * Models a pack installed before the per-file install manifest existed: a
 * pack dir with `pack.yaml` but no `.agentsmesh-install-manifest.json`.
 * `runUninstall` must:
 *   - Call `migrateLegacyManifest` and surface its warning.
 *   - Generate a baseline manifest derived from current pack contents.
 *   - Proceed with the uninstall: pack dir removed, installs.yaml entry
 *     removed, exit 0.
 *   - Report `legacy_migrated: true` on the corresponding `removed[]` row.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';
import { INSTALL_MANIFEST_FILENAME } from '../../src/install/manifest/install-manifest-hash.js';

const ROOT = join(tmpdir(), 'am-uninstall-legacy-pack-integration');

function buildUpstream(upstream: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(can, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: body\n---\n# demo\n',
  );
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

describe('uninstall legacy pack (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('auto-migrates manifest, removes pack and yaml entry, exits 0', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'demo-pack');
    const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
    expect(existsSync(manifestPath)).toBe(true);
    unlinkSync(manifestPath);
    expect(existsSync(manifestPath)).toBe(false);

    const result = await runUninstall({ force: true }, ['demo-pack'], project);

    expect(result.exitCode).toBe(0);
    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.legacy_migrated).toBe(true);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(true);
    expect(existsSync(packDir)).toBe(false);
  });

  it('dry-run does NOT persist the legacy manifest baseline to disk (M2)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'demo-pack');
    const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
    expect(existsSync(manifestPath)).toBe(true);
    unlinkSync(manifestPath);
    expect(existsSync(manifestPath)).toBe(false);

    const result = await runUninstall({ force: true, 'dry-run': true }, ['demo-pack'], project);

    // Dry-run preview is a true no-op: the legacy migration code path runs in
    // memory so drift detection still works, but nothing lands on disk.
    expect(result.exitCode).toBe(0);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.removed[0]?.legacy_migrated).toBe(true);
    expect(existsSync(manifestPath)).toBe(false);
    // Pack directory is preserved under dry-run.
    expect(existsSync(packDir)).toBe(true);
  });
});
