/**
 * Integration: `agentsmesh uninstall --keep-generated`.
 *
 * `--keep-generated` skips the post-uninstall generate pass so target
 * trees can be inspected before they're cleaned. After the uninstall:
 *   - pack dir is gone, installs.yaml entry is gone.
 *   - generated files derived from the pack are STILL on disk.
 *   - re-running `runGenerate()` (here directly) evicts them via the
 *     existing `cleanupStaleGeneratedOutputs` pass.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';
import { runGenerate } from '../../src/cli/commands/generate.js';

const ROOT = join(tmpdir(), 'am-uninstall-keep-generated-integration');

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

describe('uninstall --keep-generated (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'));
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('leaves generated target files in place; later generate cleans them', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'demo-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'demo-pack');
    const generatedSkill = join(project, '.claude', 'skills', 'demo', 'SKILL.md');
    expect(existsSync(generatedSkill)).toBe(true);

    const result = await runUninstall(
      { force: true, 'keep-generated': true },
      ['demo-pack'],
      project,
    );

    expect(result.exitCode).toBe(0);
    expect(existsSync(packDir)).toBe(false);
    // Target files survive the uninstall pass.
    expect(existsSync(generatedSkill)).toBe(true);

    // A subsequent generate evicts the now-stale file.
    await runGenerate({}, project, { printMatrix: false });
    expect(existsSync(generatedSkill)).toBe(false);
  });
});
