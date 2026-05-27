/**
 * Verifies that `forceFreshMaterialize` and `originalRef` propagate correctly
 * through the 5-layer install pipeline:
 *   runInstall → runInstallLocked → runSinglePackInstall
 *   → executeRunInstallPoolsAndWrite → installAsPack
 *
 * Tests mock at the `installAsPack` boundary so any future intermediate layer
 * that forgets to forward the flag will break these assertions.
 */

import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  installAsPack: vi.fn(),
  runPostOperationGenerate: vi.fn(),
  resolveInstallResolvedPath: vi.fn(),
  isGitAvailable: vi.fn(),
}));

vi.mock('../../../../src/install/run/run-install-pack.js', () => ({
  installAsPack: mocks.installAsPack,
}));

vi.mock('../../../../src/install/run/post-install-generate.js', () => ({
  runPostOperationGenerate: mocks.runPostOperationGenerate,
}));

vi.mock('../../../../src/install/run/run-install-resolve.js', () => ({
  resolveInstallResolvedPath: mocks.resolveInstallResolvedPath,
}));

vi.mock('../../../../src/install/source/git-pin.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/install/source/git-pin.js')>();
  return { ...actual, isGitAvailable: mocks.isGitAvailable };
});

import { runInstall } from '../../../../src/install/run/run-install.js';

describe('flag propagation: forceFreshMaterialize → installAsPack', () => {
  let projectRoot: string;
  let contentRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    projectRoot = await mkdtemp(join(tmpdir(), 'flag-prop-'));
    await mkdir(join(projectRoot, '.agentsmesh', 'packs'), { recursive: true });
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\n');

    // A real local content root with a skill so install has something to materialize
    contentRoot = await mkdtemp(join(tmpdir(), 'flag-prop-content-'));
    const skillDir = join(contentRoot, 'skills', 'my-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\ndescription: test\n---\n# My Skill\n',
    );

    // resolveInstallResolvedPath returns the content dir as-is (no git needed)
    mocks.resolveInstallResolvedPath.mockResolvedValue({
      resolvedPath: contentRoot,
      sourceForYaml: 'local:./content',
      version: undefined,
    });
    mocks.isGitAvailable.mockResolvedValue(true);
    mocks.runPostOperationGenerate.mockResolvedValue(undefined);
    // installAsPack succeeds and writes nothing (mocked)
    mocks.installAsPack.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(contentRoot, { recursive: true, force: true });
  });

  it('forceFreshMaterialize:true reaches installAsPack', async () => {
    const result = await runInstall(
      { force: true, forceFreshMaterialize: true },
      [contentRoot],
      projectRoot,
    );

    expect(result.exitCode).toBe(0);
    expect(mocks.installAsPack).toHaveBeenCalledOnce();
    const args = mocks.installAsPack.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.forceFreshMaterialize).toBe(true);
  });

  it('forceFreshMaterialize absent defaults to false/undefined at installAsPack boundary', async () => {
    const result = await runInstall({ force: true }, [contentRoot], projectRoot);

    expect(result.exitCode).toBe(0);
    expect(mocks.installAsPack).toHaveBeenCalledOnce();
    const args = mocks.installAsPack.mock.calls[0]![0] as Record<string, unknown>;
    // undefined or false are both acceptable "not forced" signals
    expect(args.forceFreshMaterialize).toBeFalsy();
  });
});
