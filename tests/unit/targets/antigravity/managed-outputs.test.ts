/**
 * Revocation guard: an agent deleted from `.agentsmesh/agents/` must stop being
 * an Antigravity subagent. `cleanupStaleGeneratedOutputs` is the only eviction
 * path, so both native agent directories have to be in `managedOutputs.dirs`;
 * otherwise the file survives with its `tools:` grant and a later import
 * resurrects it into canonical.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanupStaleGeneratedOutputs,
  findStaleGeneratedOutputs,
} from '../../../../src/core/generate/stale-cleanup.js';
import { getTargetManagedOutputs } from '../../../../src/targets/catalog/builtin-targets.js';
import {
  ANTIGRAVITY_AGENTS_DIR,
  ANTIGRAVITY_GLOBAL_AGENTS_DIR,
} from '../../../../src/targets/antigravity/constants.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-managed-outputs-test');

function write(rel: string, content: string): void {
  mkdirSync(join(TEST_DIR, rel, '..'), { recursive: true });
  writeFileSync(join(TEST_DIR, rel), content);
}

describe('antigravity managed outputs', () => {
  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('manages the native agents directory at both scopes', () => {
    expect(getTargetManagedOutputs('antigravity', 'project')!.dirs).toContain(
      ANTIGRAVITY_AGENTS_DIR,
    );
    expect(getTargetManagedOutputs('antigravity', 'global')!.dirs).toContain(
      ANTIGRAVITY_GLOBAL_AGENTS_DIR,
    );
  });

  it('evicts a project agent whose canonical source was deleted', async () => {
    write(`${ANTIGRAVITY_AGENTS_DIR}/kept.md`, '---\nname: kept\n---\n');
    write(`${ANTIGRAVITY_AGENTS_DIR}/revoked.md`, '---\nname: revoked\ntools: [Bash]\n---\n');

    const expectedPaths = [`${ANTIGRAVITY_AGENTS_DIR}/kept.md`];
    expect(
      await findStaleGeneratedOutputs({
        projectRoot: TEST_DIR,
        targets: ['antigravity'],
        expectedPaths,
      }),
    ).toEqual([`${ANTIGRAVITY_AGENTS_DIR}/revoked.md`]);

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_DIR,
      targets: ['antigravity'],
      expectedPaths,
    });
    expect(existsSync(join(TEST_DIR, ANTIGRAVITY_AGENTS_DIR, 'kept.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, ANTIGRAVITY_AGENTS_DIR, 'revoked.md'))).toBe(false);
  });

  it('evicts a global agent whose canonical source was deleted', async () => {
    write(`${ANTIGRAVITY_GLOBAL_AGENTS_DIR}/kept/agent.md`, '---\nname: kept\n---\n');
    write(`${ANTIGRAVITY_GLOBAL_AGENTS_DIR}/revoked/agent.md`, '---\nname: revoked\n---\n');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_DIR,
      targets: ['antigravity'],
      expectedPaths: [`${ANTIGRAVITY_GLOBAL_AGENTS_DIR}/kept/agent.md`],
      scope: 'global',
    });
    expect(existsSync(join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'kept/agent.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, ANTIGRAVITY_GLOBAL_AGENTS_DIR, 'revoked/agent.md'))).toBe(
      false,
    );
  });
});
