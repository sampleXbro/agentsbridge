/**
 * Integration: pack dir manually removed before uninstall.
 *
 * Models the case where a teammate or filesystem accident deletes the
 * `.agentsmesh/packs/<name>/` tree but leaves the `installs.yaml` entry.
 * `agentsmesh uninstall` must:
 *   - Not throw on the missing pack.
 *   - Emit a warning naming the missing path (assertion: pack_path reported
 *     in the result; runtime warning surfaced via logger).
 *   - Still remove the `installs.yaml` entry so subsequent `--sync` won't
 *     try to reinstall it.
 *   - Exit 0 (the operation succeeded — there was nothing on disk to delete).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-missing-integration');

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
  writeFileSync(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

describe('uninstall missing pack (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('treats a vanished pack dir as a soft delete: yaml entry removed, exit 0', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'demo-pack');
    rmSync(packDir, { recursive: true, force: true });
    expect(existsSync(packDir)).toBe(false);

    const result = await runUninstall({ force: true }, ['demo-pack'], project);

    expect(result.exitCode).toBe(0);
    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(true);
    expect(result.data.removed[0]?.pack_path).toBe('.agentsmesh/packs/demo-pack');

    const installsYaml = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expect(installsYaml).not.toContain('demo-pack');
  });
});
