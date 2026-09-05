/**
 * The directory sweep may only delete a file the PREVIOUS run generated.
 *
 * `managedOutputs.dirs` is swept recursively, but its contents are dynamic, so
 * a descriptor cannot enumerate them the way `coOwnedFiles` enumerates shared
 * files. The previous run's lock `outputs` map is that missing provenance
 * record: a file under a managed dir that agentsmesh never wrote belongs to the
 * tool or the user and must survive.
 *
 * `generatedOutputs` is required on the DELETE path and optional on the report
 * path. `agentsmesh check` (src/core/check/lock-sync.ts) omits it on purpose —
 * it passes the lock's own outputs map as `expectedPaths`, so gating there
 * would make its stale set unconditionally empty.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanupStaleGeneratedOutputs,
  findStaleGeneratedOutputs,
} from '../../../../src/core/generate/stale-cleanup.js';
import {
  getDescriptor,
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';

const TEST_ROOT = join(tmpdir(), 'agentsmesh-stale-provenance-test');

function seed(relPath: string, content = 'x'): void {
  const abs = join(TEST_ROOT, relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

function present(relPath: string): boolean {
  return existsSync(join(TEST_ROOT, relPath));
}

beforeAll(async () => {
  const mod: { descriptor: unknown } =
    await import('../../../fixtures/plugins/rich-plugin/index.js');
  registerTargetDescriptor(mod.descriptor as TargetDescriptor);
  expect(getDescriptor('rich-plugin')).toBeDefined();
});

afterAll(() => {
  resetRegistry();
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('directory sweep is gated on previous-run provenance', () => {
  it('keeps a Kiro-authored hook the run never generated', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('.kiro/hooks/my-hook.kiro.hook', '{"name":"mine"}');
    seed('.kiro/hooks/PostToolUse-0.kiro.hook', '{"name":"agentsmesh"}');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['kiro'],
      expectedPaths: [],
      generatedOutputs: ['.kiro/hooks/PostToolUse-0.kiro.hook'],
    });

    expect(present('.kiro/hooks/my-hook.kiro.hook')).toBe(true);
    expect(present('.kiro/hooks/PostToolUse-0.kiro.hook')).toBe(false);
  });

  it('still evicts a renamed rule’s previous steering file', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('.kiro/steering/old-name.md');
    seed('.kiro/steering/new-name.md');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['kiro'],
      expectedPaths: ['.kiro/steering/new-name.md'],
      generatedOutputs: ['.kiro/steering/old-name.md'],
    });

    expect(present('.kiro/steering/old-name.md')).toBe(false);
    expect(present('.kiro/steering/new-name.md')).toBe(true);
  });

  it('deletes nothing from managed dirs when there is no provenance', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('.kiro/hooks/my-hook.kiro.hook');
    seed('.kiro/steering/orphan.md');
    seed('.kiro/agents/reviewer.md');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['kiro'],
      expectedPaths: [],
      generatedOutputs: [],
    });

    expect(present('.kiro/hooks/my-hook.kiro.hook')).toBe(true);
    expect(present('.kiro/steering/orphan.md')).toBe(true);
    expect(present('.kiro/agents/reviewer.md')).toBe(true);
  });

  it('evicts a superseded nested root once the primary root is emitted, even unprovenanced', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('CLAUDE.md', 'root');
    seed('.claude/CLAUDE.md', 'legacy');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['claude-code'],
      expectedPaths: ['CLAUDE.md'],
      generatedOutputs: [],
    });

    expect(present('CLAUDE.md')).toBe(true);
    expect(present('.claude/CLAUDE.md')).toBe(false);
  });

  it('keeps the superseded nested root when the primary root is not emitted this run', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('.claude/CLAUDE.md', 'hand-written');
    seed('.claudeignore', 'hand-written');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['claude-code'],
      expectedPaths: [],
      generatedOutputs: [],
    });

    expect(present('.claude/CLAUDE.md')).toBe(true);
    expect(present('.claudeignore')).toBe(true);
  });

  it('keeps a co-owned file even when provenance claims it', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('AGENTS.md', 'root');
    seed('.codex/config.toml', 'model = "gpt-5.4"\n');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['codex-cli'],
      expectedPaths: ['AGENTS.md'],
      generatedOutputs: ['.codex/config.toml'],
    });

    expect(present('.codex/config.toml')).toBe(true);
  });

  it('gates a registered plugin descriptor’s managed dirs too', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('.rich/rules/hand-written.md', 'mine');
    seed('.rich/rules/generated.md', 'agentsmesh');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['rich-plugin'],
      expectedPaths: [],
      generatedOutputs: ['.rich/rules/generated.md'],
    });

    expect(present('.rich/rules/hand-written.md')).toBe(true);
    expect(present('.rich/rules/generated.md')).toBe(false);
  });
});

describe('report mode (no generatedOutputs) is unchanged for `agentsmesh check`', () => {
  it('reports an unlocked managed-dir file as stale', async () => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    seed('.cursor/rules/orphaned.mdc');
    seed('.cursor/rules/_root.mdc');

    const stale = await findStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['cursor'],
      expectedPaths: ['.cursor/rules/_root.mdc'],
    });

    expect(stale).toEqual(['.cursor/rules/orphaned.mdc']);
  });
});
