/**
 * Integration: `agentsmesh uninstall <name>` happy-path.
 *
 * Installs a minimal synthetic pack (1 rule + 1 skill), then uninstalls it
 * and asserts:
 *   - Pack dir under `.agentsmesh/packs/<name>/` is fully gone.
 *   - `installs.yaml` no longer carries the entry.
 *   - Post-uninstall `runGenerate()` runs at the end of uninstall and
 *     `cleanupStaleGeneratedOutputs` removes orphaned target files derived
 *     from the pack (the `.claude/skills/<name>/` tree).
 *   - exitCode === 0; UninstallData.removed shape carries the new entry.
 *
 * Fixtures built inline per the P9 convention.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-basic-integration');

function buildUpstream(upstream: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'skills', 'demo'), { recursive: true });
  mkdirSync(join(can, 'rules'), { recursive: true });
  writeFileSync(
    join(can, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: Demo skill body\n---\n# demo\n',
  );
  writeFileSync(
    join(can, 'rules', 'security.md'),
    '---\ndescription: security\n---\nrule body\n',
  );
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

describe('uninstall basic (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('removes pack dir, installs.yaml entry, and cleans generated target files', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packsDir = join(project, '.agentsmesh', 'packs');
    const packDir = join(packsDir, 'demo-pack');
    expect(readdirSync(packsDir)).toEqual(['demo-pack']);
    expect(existsSync(join(project, '.claude', 'skills', 'demo', 'SKILL.md'))).toBe(true);

    const installsYaml = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expect(installsYaml).toContain('name: demo-pack');

    const result = await runUninstall({ force: true }, ['demo-pack'], project);

    expect(result.exitCode).toBe(0);
    expect(result.data.mode).toBe('uninstall');
    expect(result.data.dryRun).toBe(false);
    expect(result.data.skipped).toEqual([]);
    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(true);
    expect(result.data.removed[0]?.extends_entry_removed).toBe(false);
    expect(result.data.removed[0]?.legacy_migrated).toBe(false);
    expect(result.data.removed[0]?.modified_files_kept).toEqual([]);
    expect(result.data.removed[0]?.pack_path).toBe('.agentsmesh/packs/demo-pack');

    expect(existsSync(packDir)).toBe(false);
    expect(readdirSync(packsDir)).toEqual([]);

    const installsYamlAfter = readFileSync(
      join(project, '.agentsmesh', 'installs.yaml'),
      'utf-8',
    );
    expect(installsYamlAfter).not.toContain('demo-pack');

    expect(existsSync(join(project, '.claude', 'skills', 'demo', 'SKILL.md'))).toBe(false);
  });
});
