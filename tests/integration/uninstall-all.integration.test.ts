/**
 * Integration: `agentsmesh uninstall --all`.
 *
 * Installs two distinct packs, then uninstalls everything in a single
 * invocation. `--force` bypasses the would-be confirmation prompt. After
 * the call the `packs/` directory is empty, `installs.yaml` carries no
 * entries, and `data.removed` lists both names.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-all-integration');

function buildUpstream(upstream: string, skillName: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'skills', skillName), { recursive: true });
  writeFileSync(
    join(can, 'skills', skillName, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: ${skillName} body\n---\n# ${skillName}\n`,
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

describe('uninstall --all (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream-alpha'), 'alpha');
    buildUpstream(join(ROOT, 'upstream-beta'), 'beta');
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('removes every installed pack and empties installs.yaml', async () => {
    const project = join(ROOT, 'project');

    await runInstall(
      { force: true, name: 'pack-alpha' },
      [join(ROOT, 'upstream-alpha')],
      project,
    );
    await runInstall(
      { force: true, name: 'pack-beta' },
      [join(ROOT, 'upstream-beta')],
      project,
    );

    const packsDir = join(project, '.agentsmesh', 'packs');
    expect(readdirSync(packsDir).sort()).toEqual(['pack-alpha', 'pack-beta']);

    const result = await runUninstall({ force: true, all: true }, [], project);

    expect(result.exitCode).toBe(0);
    expect(result.data.removed.map((r) => r.name).sort()).toEqual(['pack-alpha', 'pack-beta']);
    expect(readdirSync(packsDir)).toEqual([]);

    const installsYaml = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expect(installsYaml).not.toContain('pack-alpha');
    expect(installsYaml).not.toContain('pack-beta');
  });
});
