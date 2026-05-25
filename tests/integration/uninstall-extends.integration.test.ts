/**
 * Integration: install --extends then uninstall.
 *
 * `--extends` writes the install as an `extends:` entry in
 * `agentsmesh.yaml` instead of materializing a pack under
 * `.agentsmesh/packs/`. Uninstall must drop that yaml row (plus the
 * `installs.yaml` row), even though there is no pack dir to delete.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-extends-integration');

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

describe('uninstall --extends entry (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('removes the extends entry from agentsmesh.yaml on uninstall', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-extends', extends: true }, [upstream], project);

    const configPath = join(project, 'agentsmesh.yaml');
    const cfgBefore = readFileSync(configPath, 'utf-8');
    expect(cfgBefore).toContain('name: demo-extends');

    const result = await runUninstall({ force: true }, ['demo-extends'], project);

    expect(result.exitCode).toBe(0);
    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-extends']);
    expect(result.data.removed[0]?.extends_entry_removed).toBe(true);
    // install --extends does not write to installs.yaml, so nothing to drop there.
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(false);
    // No pack directory was ever materialized, so `pack_path` must be null
    // rather than a synthesized `.agentsmesh/packs/<name>` placeholder.
    expect(result.data.removed[0]?.pack_path).toBeNull();

    const cfgAfter = readFileSync(configPath, 'utf-8');
    expect(cfgAfter).not.toContain('name: demo-extends');
  });
});
