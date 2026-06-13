/**
 * Integration test: refresh against a bare git source.
 *
 * Flow: create a bare git repo with two commits → install at firstSha using a
 * branch ref → advance upstream → runRefresh → assert v2 content on disk.
 *
 * The install pipeline now captures the user's original ref expression in
 * `installs.yaml` as `original_ref`. The refresh planner re-resolves that ref
 * against the remote rather than the pinned SHA stored in `source`, so no
 * manual patching of the manifest is required.
 */

import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRefresh } from '../../src/install/refresh/run-refresh.js';
import { runInstall } from '../../src/install/run/run-install.js';
import {
  appendCommitToMain,
  createBareRepoWithTwoCommits,
  rewindRepoToFirstCommit,
  type BareRepoWithTwoCommits,
} from './fixtures/refresh-git-source/setup.js';
import { readInstallManifest } from '../helpers/install-test-helpers.js';

const execFileP = promisify(execFile);

describe('refresh against a git source', () => {
  let projectRoot: string;
  let bare: BareRepoWithTwoCommits;
  const ORIGINAL_ALLOW_LOCAL_GIT = process.env.AGENTSMESH_ALLOW_LOCAL_GIT;

  beforeEach(async () => {
    process.env.AGENTSMESH_ALLOW_LOCAL_GIT = '1';
    projectRoot = await mkdtemp(join(tmpdir(), 'refresh-int-'));
    await mkdir(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
    await writeFile(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets:\n  - claude-code\nfeatures:\n  - skills\nextends: []\n',
    );
    await writeFile(
      join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
    bare = await createBareRepoWithTwoCommits();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await bare.cleanup();
    if (ORIGINAL_ALLOW_LOCAL_GIT === undefined) {
      delete process.env.AGENTSMESH_ALLOW_LOCAL_GIT;
    } else {
      process.env.AGENTSMESH_ALLOW_LOCAL_GIT = ORIGINAL_ALLOW_LOCAL_GIT;
    }
  });

  it('refresh moves the pack to the new ref tip when upstream advances', async () => {
    // Rewind upstream so install captures v1
    await rewindRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);

    // Install at firstSha using git+file:// URL with branch ref (#main).
    // The install pipeline will capture original_ref='main' in installs.yaml.
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;
    const installResult = await runInstall(
      { force: true, name: 'bare-pack' },
      [sourceUrl],
      projectRoot,
    );
    expect(installResult.exitCode).toBe(0);

    // Verify v1 content is on disk
    const skillPath = join(
      projectRoot,
      '.agentsmesh',
      'packs',
      'bare-pack',
      'skills',
      'a-skill',
      'SKILL.md',
    );
    const v1 = await readFile(skillPath, 'utf8');
    expect(v1).toContain('# v1');

    // Advance upstream to second SHA
    await execFileP('git', [
      '--git-dir',
      bare.bareRepoPath,
      'update-ref',
      'refs/heads/main',
      bare.secondSha,
    ]);

    // Run refresh — no manifest patching needed; original_ref captured at install time
    const refreshResult = await runRefresh({ force: true }, [], projectRoot);
    expect(refreshResult.exitCode).toBe(0);
    expect(refreshResult.data.refreshed).toHaveLength(1);

    const refreshed = refreshResult.data.refreshed[0];
    expect(refreshed).toBeDefined();
    expect(refreshed?.name).toBe('bare-pack');
    expect(refreshed?.newSha).toBe(bare.secondSha);

    // Verify v2 content is on disk after refresh
    const v2 = await readFile(skillPath, 'utf8');
    expect(v2).toContain('# v2');
  }, 30_000);

  it('keeps a branch pin tracking main across two consecutive refreshes', async () => {
    // Rewind upstream so install captures v1 at firstSha via the #main pin.
    await rewindRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);

    const manifestPath = join(projectRoot, '.agentsmesh', 'installs.yaml');
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;
    const installResult = await runInstall(
      { force: true, name: 'bare-pack' },
      [sourceUrl],
      projectRoot,
    );
    expect(installResult.exitCode).toBe(0);

    const afterInstall = readInstallManifest(manifestPath).installs;
    expect(afterInstall).toHaveLength(1);
    expect(afterInstall[0]?.original_ref).toBe('main');
    expect(afterInstall[0]?.version).toBe(bare.firstSha);

    // ── First refresh: upstream advances main → secondSha ──────────────────
    await execFileP('git', [
      '--git-dir',
      bare.bareRepoPath,
      'update-ref',
      'refs/heads/main',
      bare.secondSha,
    ]);
    const refresh1 = await runRefresh({ force: true }, [], projectRoot);
    expect(refresh1.exitCode).toBe(0);
    expect(refresh1.data.refreshed).toHaveLength(1);
    expect(refresh1.data.refreshed[0]?.newSha).toBe(bare.secondSha);

    // The pin must still be a branch name, NOT the resolved SHA.
    const afterRefresh1 = readInstallManifest(manifestPath).installs;
    expect(afterRefresh1).toHaveLength(1);
    expect(afterRefresh1[0]?.original_ref).toBe('main');
    expect(afterRefresh1[0]?.version).toBe(bare.secondSha);

    // ── Second refresh: upstream advances main again → thirdSha ────────────
    const thirdSha = await appendCommitToMain(bare.bareRepoPath, 'v3');
    const refresh2 = await runRefresh({ force: true }, [], projectRoot);
    expect(refresh2.exitCode).toBe(0);
    // Regression guard: a frozen pin would report `unchanged` here.
    expect(refresh2.data.unchanged).toHaveLength(0);
    expect(refresh2.data.refreshed).toHaveLength(1);
    expect(refresh2.data.refreshed[0]?.newSha).toBe(thirdSha);

    const afterRefresh2 = readInstallManifest(manifestPath).installs;
    expect(afterRefresh2).toHaveLength(1);
    expect(afterRefresh2[0]?.original_ref).toBe('main');
    expect(afterRefresh2[0]?.version).toBe(thirdSha);

    const v3 = await readFile(
      join(projectRoot, '.agentsmesh', 'packs', 'bare-pack', 'skills', 'a-skill', 'SKILL.md'),
      'utf8',
    );
    expect(v3).toContain('# v3');
  }, 45_000);

  it('refresh leaves unchanged packs when the ref has not moved', async () => {
    // Install at current tip (secondSha since bare has both commits).
    // original_ref='main' is captured automatically.
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;
    const installResult = await runInstall(
      { force: true, name: 'bare-pack' },
      [sourceUrl],
      projectRoot,
    );
    expect(installResult.exitCode).toBe(0);

    // Refresh without advancing upstream — original_ref resolves to secondSha
    // which equals the stored version → classification = unchanged.
    const refreshResult = await runRefresh({ force: true }, [], projectRoot);
    expect(refreshResult.exitCode).toBe(0);
    expect(refreshResult.data.unchanged).toHaveLength(1);
    expect(refreshResult.data.refreshed).toHaveLength(0);
    expect(refreshResult.data.unchanged[0]?.name).toBe('bare-pack');
  }, 30_000);
});
