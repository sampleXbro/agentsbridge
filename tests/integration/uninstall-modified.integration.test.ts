/**
 * Integration: modification detection on uninstall.
 *
 * Scenario A: user edits a tracked file inside the pack dir, then runs
 *   `agentsmesh uninstall --force <name>`. `--force` bypasses the prompt
 *   with the documented `delete-anyway` default; the pack is removed and
 *   the modification list is NOT surfaced in `modified_files_kept`.
 *
 * Scenario B: same setup but with `--keep-pack`. This emulates the
 *   `[k]eep-modified` prompt action at the apply layer — `planUninstall`
 *   nulls the `packDir` so `applyUninstall` leaves the directory alone,
 *   while still dropping the `installs.yaml` entry. The actual prompt
 *   branch (returning `keep-modified`) is unit-covered in
 *   `tests/unit/install/prompts/modified-files-prompt.test.ts` — adding
 *   prompt-adapter plumbing through `runUninstall` for integration would
 *   expand the public API for tests only (same trade-off P9 documented for
 *   the install bulk + broken-link prompts).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-modified-integration');

function buildUpstream(upstream: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(can, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: original body\n---\n# demo\n',
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

describe('uninstall modified (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('--force deletes the pack even when a tracked file was locally modified', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'demo-pack');
    const skillPath = join(packDir, 'skills', 'demo', 'SKILL.md');
    writeFileSync(skillPath, '---\nname: demo\ndescription: USER-EDITED\n---\n# tampered\n');

    const result = await runUninstall({ force: true }, ['demo-pack'], project);

    expect(result.exitCode).toBe(0);
    expect(existsSync(packDir)).toBe(false);
    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(true);
    expect(result.data.removed[0]?.modified_files_kept).toEqual([]);
  });

  it('--keep-pack preserves the pack dir but still drops the installs.yaml entry', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packsDir = join(project, '.agentsmesh', 'packs');
    const packDir = join(packsDir, 'demo-pack');
    const skillPath = join(packDir, 'skills', 'demo', 'SKILL.md');
    const tamperedBody = '---\nname: demo\ndescription: USER-EDITED\n---\n# tampered\n';
    writeFileSync(skillPath, tamperedBody);

    const result = await runUninstall(
      { force: true, 'keep-pack': true },
      ['demo-pack'],
      project,
    );

    expect(result.exitCode).toBe(0);
    expect(readdirSync(packsDir)).toEqual(['demo-pack']);
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, 'utf-8')).toBe(tamperedBody);

    const installsYaml = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expect(installsYaml).not.toContain('demo-pack');

    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(true);
  });
});
