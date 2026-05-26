/**
 * Integration test: refresh against a bare git source.
 *
 * Flow: create a bare git repo with two commits → install at firstSha
 * (by patching installs.yaml to store the branch ref rather than the pinned
 * SHA that the install pipeline produces) → advance upstream → runRefresh →
 * assert v2 content on disk.
 *
 * Why patch installs.yaml: the install pipeline stores a SHA-pinned source
 * (git+file:///path#sha), while the refresh planner uses the source's ref
 * fragment to re-resolve via git ls-remote. Storing the branch name in source
 * is the intended semantic contract (as the unit test fixtures show), so the
 * patch simulates a correct future install while still exercising the full
 * refresh pipeline end-to-end.
 */

import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import { runRefresh } from '../../src/install/refresh/run-refresh.js';
import { runInstall } from '../../src/install/run/run-install.js';
import {
  createBareRepoWithTwoCommits,
  rewindRepoToFirstCommit,
  type BareRepoWithTwoCommits,
} from './fixtures/refresh-git-source/setup.js';

const execFileP = promisify(execFile);

/** Rewrite installs.yaml source to use branch ref instead of pinned SHA. */
async function patchInstallsYamlToBranchRef(
  canonicalDir: string,
  packName: string,
  branchSource: string,
): Promise<void> {
  const manifestPath = join(canonicalDir, 'installs.yaml');
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = parseYaml(raw) as { version: number; installs: Array<Record<string, unknown>> };
  for (const entry of parsed.installs) {
    if (entry['name'] === packName) {
      entry['source'] = branchSource;
      delete entry['version']; // remove pinned SHA; refresh will derive newSha via ls-remote
    }
  }
  await writeFile(
    manifestPath,
    `# yaml-language-server: $schema=https://agentsmesh.ai/schema/installs.json\n${yamlStringify({ version: 1, installs: parsed.installs })}`,
  );
}

describe('refresh against a git source', () => {
  let projectRoot: string;
  let bare: BareRepoWithTwoCommits;

  beforeEach(async () => {
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
  });

  it('refresh moves the pack to the new ref tip when upstream advances', async () => {
    // Rewind upstream so install captures v1
    await rewindRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);

    // Install at firstSha using git+file:// URL with a predictable pack name
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

    // Patch installs.yaml to store branch ref form (not pinned SHA)
    // so the refresh planner can re-resolve via git ls-remote
    const canonicalDir = join(projectRoot, '.agentsmesh');
    const branchSource = `git+file://${bare.bareRepoPath}#main`;
    await patchInstallsYamlToBranchRef(canonicalDir, 'bare-pack', branchSource);

    // Advance upstream to second SHA
    await execFileP('git', [
      '--git-dir',
      bare.bareRepoPath,
      'update-ref',
      'refs/heads/main',
      bare.secondSha,
    ]);

    // Run refresh
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

  it('refresh leaves unchanged packs when the ref has not moved', async () => {
    // Install at current tip (secondSha since bare has both commits)
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;
    const installResult = await runInstall(
      { force: true, name: 'bare-pack' },
      [sourceUrl],
      projectRoot,
    );
    expect(installResult.exitCode).toBe(0);

    // Patch installs.yaml to branch ref form but PRESERVE the version field
    // (which ls-remote will also return), so oldSha === newSha → unchanged.
    const canonicalDir = join(projectRoot, '.agentsmesh');
    const manifestPath = join(canonicalDir, 'installs.yaml');
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = parseYaml(raw) as {
      version: number;
      installs: Array<Record<string, unknown>>;
    };
    for (const entry of parsed.installs) {
      if (entry['name'] === 'bare-pack') {
        // Store branch ref as source so ls-remote resolves it, but keep the
        // version (pinned SHA) so oldSha === newSha → classification = unchanged.
        entry['source'] = `git+file://${bare.bareRepoPath}#main`;
        // version stays as the secondSha that ls-remote will return
        entry['version'] = bare.secondSha;
      }
    }
    await writeFile(
      manifestPath,
      `# yaml-language-server: $schema=https://agentsmesh.ai/schema/installs.json\n${yamlStringify({ version: 1, installs: parsed.installs })}`,
    );

    // Refresh without advancing upstream — ref resolves to secondSha, version = secondSha → unchanged
    const refreshResult = await runRefresh({ force: true }, [], projectRoot);
    expect(refreshResult.exitCode).toBe(0);
    expect(refreshResult.data.unchanged).toHaveLength(1);
    expect(refreshResult.data.refreshed).toHaveLength(0);
    expect(refreshResult.data.unchanged[0]?.name).toBe('bare-pack');
  }, 30_000);
});
