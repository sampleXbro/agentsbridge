/**
 * Integration: `agentsmesh uninstall --dry-run`.
 *
 * Dry-run preview must:
 *   - Leave the pack dir, installs.yaml entry, agentsmesh.yaml extends list,
 *     and generated target files completely untouched.
 *   - Return `data.dryRun === true` and `removed[].manifest_entry_removed === false`
 *     (nothing was actually written).
 *   - Still surface what *would* be removed via `data.removed[]`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-dry-run-integration');

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

describe('uninstall --dry-run (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('previews removal without writing to disk', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'demo-pack');
    const installsPath = join(project, '.agentsmesh', 'installs.yaml');
    const configPath = join(project, 'agentsmesh.yaml');
    const generatedSkill = join(project, '.claude', 'skills', 'demo', 'SKILL.md');

    const installsBefore = readFileSync(installsPath, 'utf-8');
    const configBefore = readFileSync(configPath, 'utf-8');
    expect(existsSync(packDir)).toBe(true);
    expect(existsSync(generatedSkill)).toBe(true);

    const result = await runUninstall(
      { force: true, 'dry-run': true },
      ['demo-pack'],
      project,
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.dryRun).toBe(true);
    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(false);
    expect(result.data.removed[0]?.extends_entry_removed).toBe(false);

    expect(existsSync(packDir)).toBe(true);
    expect(existsSync(generatedSkill)).toBe(true);
    expect(readFileSync(installsPath, 'utf-8')).toBe(installsBefore);
    expect(readFileSync(configPath, 'utf-8')).toBe(configBefore);
  });
});
