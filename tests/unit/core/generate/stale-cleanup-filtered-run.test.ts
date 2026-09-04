/**
 * A filtered run (`--targets x`) must not delete a configured-but-inactive
 * target's outputs.
 *
 * Several targets manage the same directory — `.agents/skills` is a managed dir
 * for amp, zed, goose, codex-cli and others. `generate --targets zed` sweeps it
 * while the engine emits nothing for amp, so amp's `.agents/skills/am-agent-*`
 * bundles land in the stale set. Provenance cannot rescue them: agentsmesh DID
 * write them, so they are in the lock's outputs map. The guard is ownership,
 * not provenance — a dir another configured target also manages is skipped.
 *
 * Cost: stale files in a shared dir survive until the next unfiltered run,
 * which matches the lock's own filtered-run rule (it merges, never prunes).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanupStaleGeneratedOutputs } from '../../../../src/core/generate/stale-cleanup.js';

const TEST_ROOT = join(tmpdir(), 'agentsmesh-stale-filtered-run-test');

function seed(relPath: string): void {
  const abs = join(TEST_ROOT, relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, 'x');
}

function present(relPath: string): boolean {
  return existsSync(join(TEST_ROOT, relPath));
}

afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

describe('filtered run leaves an inactive target’s shared directory alone', () => {
  it('keeps amp’s .agents/skills bundle when only zed is generated', async () => {
    seed('.agents/skills/am-agent-reviewer/SKILL.md');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['zed'],
      expectedPaths: ['AGENTS.md'],
      generatedOutputs: ['.agents/skills/am-agent-reviewer/SKILL.md'],
      inactiveTargets: ['amp'],
    });

    expect(present('.agents/skills/am-agent-reviewer/SKILL.md')).toBe(true);
  });

  it('still evicts from a dir no inactive target manages', async () => {
    // One run sweeping both dirs: `.cursor/rules` is cursor's alone, so it is
    // pruned; `.agents/skills` is shared with the inactive amp, so it is not.
    seed('.cursor/rules/old.mdc');
    seed('.agents/skills/am-agent-reviewer/SKILL.md');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['cursor', 'zed'],
      expectedPaths: [],
      generatedOutputs: ['.cursor/rules/old.mdc', '.agents/skills/am-agent-reviewer/SKILL.md'],
      inactiveTargets: ['amp'],
    });

    expect(present('.cursor/rules/old.mdc')).toBe(false);
    expect(present('.agents/skills/am-agent-reviewer/SKILL.md')).toBe(true);
  });

  it('tolerates an inactive target with no layout in this scope', async () => {
    // `replit-agent` is cloud-only: it has a project layout and no global one,
    // so a global filtered run asks for managed dirs that do not exist.
    seed('.claude/commands/old.md');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['claude-code'],
      expectedPaths: [],
      generatedOutputs: ['.claude/commands/old.md'],
      inactiveTargets: ['replit-agent'],
      scope: 'global',
    });

    expect(present('.claude/commands/old.md')).toBe(false);
  });

  it('sweeps every managed dir on an unfiltered run (no inactive targets)', async () => {
    seed('.agents/skills/am-agent-reviewer/SKILL.md');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['zed'],
      expectedPaths: [],
      generatedOutputs: ['.agents/skills/am-agent-reviewer/SKILL.md'],
      inactiveTargets: [],
    });

    expect(present('.agents/skills/am-agent-reviewer/SKILL.md')).toBe(false);
  });
});
