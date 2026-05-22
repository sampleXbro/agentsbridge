/**
 * Integration: uninstall must remove ALL generated target files derived from a
 * pack, including files produced by entity-type conversions:
 *
 *   - antigravity: commands → workflows (`.agents/workflows/<name>.md`)
 *   - antigravity: agents     → skills    (`.agents/skills/am-agent-<name>/SKILL.md`)
 *
 * Without these cleanups, projected files linger in the project tree after
 * uninstall — the per-target `managedOutputs` table is the only thing
 * `cleanupStaleGeneratedOutputs` consults, so any conversion-output directory
 * that's not declared there will be missed.
 *
 * Sibling conversions for other targets (factory-droid commands→skills,
 * codex-cli commands→skills, windsurf commands→workflows + agents→skills) are
 * exercised by their own end-to-end tests because their `managedOutputs`
 * already cover the projected dirs. This test focuses on the antigravity gap
 * the user surfaced post-implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { runUninstall } from '../../src/install/uninstall/run-uninstall.js';

const ROOT = join(tmpdir(), 'am-uninstall-conversion-cleanup');

function buildUpstream(upstream: string): void {
  const can = join(upstream, '.agentsmesh');
  mkdirSync(join(can, 'commands'), { recursive: true });
  mkdirSync(join(can, 'agents'), { recursive: true });
  writeFileSync(
    join(can, 'commands', 'review.md'),
    '---\ndescription: Review the diff\n---\n# review\n',
  );
  writeFileSync(
    join(can, 'agents', 'reviewer.md'),
    '---\ndescription: Reviewer agent\n---\n# reviewer body\n',
  );
}

function buildProject(project: string, features: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    `version: 1\ntargets: [antigravity]\nfeatures: [${features}]\nextends: []\n`,
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

describe('uninstall cleans converted-entity outputs (antigravity)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    buildUpstream(join(ROOT, 'upstream'));
    buildProject(join(ROOT, 'project'), 'rules, commands, agents');
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('removes .agents/workflows/<command>.md (commands → workflows) on uninstall', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'conv-pack' }, [upstream], project);

    const workflowPath = join(project, '.agents', 'workflows', 'review.md');
    expect(existsSync(workflowPath)).toBe(true);

    const result = await runUninstall({ force: true }, ['conv-pack'], project);
    expect(result.exitCode).toBe(0);

    // The projected workflow must not linger after uninstall — it was created
    // solely from the canonical command that the pack contributed.
    expect(existsSync(workflowPath)).toBe(false);
  });

  it('removes .agents/skills/am-agent-<name>/SKILL.md (agents → skills) on uninstall', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'conv-pack' }, [upstream], project);

    const skillDir = join(project, '.agents', 'skills', 'am-agent-reviewer');
    expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);

    const result = await runUninstall({ force: true }, ['conv-pack'], project);
    expect(result.exitCode).toBe(0);

    // The projected skill dir must also be removed; cleanup is the only thing
    // standing between "uninstalled" and "still littering the user's project".
    expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(false);
  });
});
