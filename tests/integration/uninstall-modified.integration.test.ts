/**
 * Integration: modification detection on uninstall.
 *
 * Scenario A: user edits a tracked file inside the pack dir, then runs
 *   `agentsmesh uninstall --force <name>`. `--force` bypasses the prompt
 *   with the documented `delete-anyway` default; the pack is removed and
 *   the modification list is NOT surfaced in `modified_files_kept`.
 *
 * Scenario B: same setup but with `--keep-pack`. The flag short-circuits
 *   the prompt entirely; `applyUninstall` leaves the directory alone but
 *   drops the `installs.yaml` entry. Phase 3.11's contract additionally
 *   asserts `modified_files_kept` is populated so the JSON record names
 *   the user's edits.
 *
 * Scenario C: interactive prompt path. The user is offered the choice and
 *   picks `[k]eep-modified`. Same disk effect as Scenario B but routed
 *   through `runModifiedFilesPrompt`. Uses `runUninstall`'s test-seam
 *   options (`promptAdapter`, `assumeTty`) so the path exercises the real
 *   `gatherUninstallDecisions` → prompt → `applyUninstall` chain without
 *   forking a TTY.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
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
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
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

    const result = await runUninstall({ force: true, 'keep-pack': true }, ['demo-pack'], project);

    expect(result.exitCode).toBe(0);
    expect(readdirSync(packsDir)).toEqual(['demo-pack']);
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, 'utf-8')).toBe(tamperedBody);

    const installsYaml = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expect(installsYaml).not.toContain('demo-pack');

    expect(result.data.removed.map((r) => r.name)).toEqual(['demo-pack']);
    expect(result.data.removed[0]?.manifest_entry_removed).toBe(true);
    // Phase 3.11: modifications must surface in the JSON record even though
    // the prompt was bypassed via `--keep-pack`.
    expect(result.data.removed[0]?.modified_files_kept.map((m) => m.relativePath)).toEqual([
      'skills/demo/SKILL.md',
    ]);
  });

  it('interactive [k]eep-modified preserves the pack and lists modified files', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packsDir = join(project, '.agentsmesh', 'packs');
    const packDir = join(packsDir, 'demo-pack');
    const skillPath = join(packDir, 'skills', 'demo', 'SKILL.md');
    const tamperedBody = '---\nname: demo\ndescription: USER-EDITED\n---\n# tampered\n';
    writeFileSync(skillPath, tamperedBody);

    const asked: string[] = [];
    const result = await runUninstall({}, ['demo-pack'], project, {
      assumeTty: true,
      promptAdapter: {
        ask: async (prompt) => {
          asked.push(prompt);
          return 'k';
        },
        write: () => {},
      },
    });

    expect(result.exitCode).toBe(0);
    // Prompt fired once for the only modified pack.
    expect(asked).toHaveLength(1);
    // Pack dir is preserved with the tampered content; installs.yaml entry is gone.
    expect(readdirSync(packsDir)).toEqual(['demo-pack']);
    expect(readFileSync(skillPath, 'utf-8')).toBe(tamperedBody);
    const installsYaml = readFileSync(join(project, '.agentsmesh', 'installs.yaml'), 'utf-8');
    expect(installsYaml).not.toContain('demo-pack');
    // JSON record names the kept files.
    expect(result.data.removed[0]?.modified_files_kept.map((m) => m.relativePath)).toEqual([
      'skills/demo/SKILL.md',
    ]);
  });
});
