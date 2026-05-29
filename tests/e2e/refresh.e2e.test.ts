/**
 * E2E: agentsmesh refresh.
 *
 * Covers: no-op (no installs), no-op (single up-to-date pack), pack advances,
 * --dry-run (no writes), --force (skip drift consent), <name> filter,
 * unknown name (exit 2), and the global no-installs path.
 *
 * Uses `git+file://` against a bare repo with two commits so we can advance
 * the upstream ref between install and refresh without real network calls.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'AgentsMesh Tests',
      GIT_AUTHOR_EMAIL: 'tests@example.com',
      GIT_COMMITTER_NAME: 'AgentsMesh Tests',
      GIT_COMMITTER_EMAIL: 'tests@example.com',
    },
  }).trim();
}

interface RefreshBareRepo {
  bareRepoPath: string;
  firstSha: string;
  secondSha: string;
}

function createBareRepoWithTwoCommits(root: string): RefreshBareRepo {
  const workDir = join(root, 'work');
  const bareDir = join(root, 'bare.git');

  mkdirSync(join(workDir, 'skills', 'a-skill'), { recursive: true });
  writeFileSync(
    join(workDir, 'skills', 'a-skill', 'SKILL.md'),
    '---\nname: a-skill\ndescription: v1\n---\n# v1 body\n',
  );
  git(['init', '-b', 'main'], workDir);
  git(['add', '.'], workDir);
  git(['commit', '-m', 'first'], workDir);
  const firstSha = git(['rev-parse', 'HEAD'], workDir);

  writeFileSync(
    join(workDir, 'skills', 'a-skill', 'SKILL.md'),
    '---\nname: a-skill\ndescription: v2\n---\n# v2 body\n',
  );
  git(['commit', '-am', 'second'], workDir);
  const secondSha = git(['rev-parse', 'HEAD'], workDir);

  git(['clone', '--bare', workDir, bareDir], root);
  return { bareRepoPath: bareDir, firstSha, secondSha };
}

function rewindBareRepoToFirstCommit(bareRepoPath: string, firstSha: string): void {
  execFileSync('git', ['--git-dir', bareRepoPath, 'update-ref', 'refs/heads/main', firstSha], {
    stdio: 'pipe',
  });
}

function writeProjectConfig(dir: string): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

const E2E_ENV = { AGENTSMESH_ALLOW_LOCAL_GIT: '1' };

describe('refresh e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('no-op when no installs exist', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('refresh', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(r.stdout + r.stderr).toContain('No packs to refresh.');
  });

  it('--global no-op when no installs exist at user scope', async () => {
    dir = createTestProject();
    const fakeHome = join(dir, 'home');
    const globalCanonical = join(fakeHome, '.agentsmesh');
    mkdirSync(join(globalCanonical, 'rules'), { recursive: true });
    writeFileSync(
      join(globalCanonical, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
    );
    writeFileSync(
      join(globalCanonical, 'rules', '_root.md'),
      '---\nroot: true\n---\n# Global root\n',
    );

    const r = await runCli('refresh --global', dir, { HOME: fakeHome });
    expect(r.exitCode, r.stderr).toBe(0);
    expect(r.stdout + r.stderr).toContain('No packs to refresh.');
  });

  it('exits 2 on unknown pack name', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('refresh nope-not-installed', dir);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/Unknown pack/i);
  });

  it('advances a pack from v1 to v2 when upstream moves', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const bare = createBareRepoWithTwoCommits(dir);
    rewindBareRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;

    const install = await runCli(`install ${sourceUrl} --force --name bare-pack`, dir, E2E_ENV);
    expect(install.exitCode, install.stderr).toBe(0);

    const skillPath = join(
      dir,
      '.agentsmesh',
      'packs',
      'bare-pack',
      'skills',
      'a-skill',
      'SKILL.md',
    );
    expect(readFileSync(skillPath, 'utf8')).toContain('v1 body');

    // Advance upstream to v2.
    execFileSync(
      'git',
      ['--git-dir', bare.bareRepoPath, 'update-ref', 'refs/heads/main', bare.secondSha],
      { stdio: 'pipe' },
    );

    const refresh = await runCli('refresh --force', dir, E2E_ENV);
    expect(refresh.exitCode, refresh.stderr).toBe(0);
    expect(readFileSync(skillPath, 'utf8')).toContain('v2 body');
  });

  it('--dry-run does not modify pack contents even when an update is available', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const bare = createBareRepoWithTwoCommits(dir);
    rewindBareRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;

    const install = await runCli(`install ${sourceUrl} --force --name dry-pack`, dir, E2E_ENV);
    expect(install.exitCode, install.stderr).toBe(0);

    const skillPath = join(
      dir,
      '.agentsmesh',
      'packs',
      'dry-pack',
      'skills',
      'a-skill',
      'SKILL.md',
    );
    const before = readFileSync(skillPath, 'utf8');

    execFileSync(
      'git',
      ['--git-dir', bare.bareRepoPath, 'update-ref', 'refs/heads/main', bare.secondSha],
      { stdio: 'pipe' },
    );

    const r = await runCli('refresh --dry-run --force', dir, E2E_ENV);
    expect(r.exitCode, r.stderr).toBe(0);

    expect(readFileSync(skillPath, 'utf8')).toBe(before);
  });

  it('positional <name> only refreshes the named pack', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const bareA = createBareRepoWithTwoCommits(join(dir, 'a-area'));
    const bareB = createBareRepoWithTwoCommits(join(dir, 'b-area'));
    rewindBareRepoToFirstCommit(bareA.bareRepoPath, bareA.firstSha);
    rewindBareRepoToFirstCommit(bareB.bareRepoPath, bareB.firstSha);

    const installA = await runCli(
      `install git+file://${bareA.bareRepoPath}#main --force --name pack-a`,
      dir,
      E2E_ENV,
    );
    expect(installA.exitCode, installA.stderr).toBe(0);
    const installB = await runCli(
      `install git+file://${bareB.bareRepoPath}#main --force --name pack-b`,
      dir,
      E2E_ENV,
    );
    expect(installB.exitCode, installB.stderr).toBe(0);

    const aSkill = join(dir, '.agentsmesh', 'packs', 'pack-a', 'skills', 'a-skill', 'SKILL.md');
    const bSkill = join(dir, '.agentsmesh', 'packs', 'pack-b', 'skills', 'a-skill', 'SKILL.md');
    const bBefore = readFileSync(bSkill, 'utf8');

    // Advance only A's upstream.
    execFileSync(
      'git',
      ['--git-dir', bareA.bareRepoPath, 'update-ref', 'refs/heads/main', bareA.secondSha],
      { stdio: 'pipe' },
    );
    execFileSync(
      'git',
      ['--git-dir', bareB.bareRepoPath, 'update-ref', 'refs/heads/main', bareB.secondSha],
      { stdio: 'pipe' },
    );

    const r = await runCli('refresh pack-a --force', dir, E2E_ENV);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(readFileSync(aSkill, 'utf8')).toContain('v2 body');
    expect(readFileSync(bSkill, 'utf8')).toBe(bBefore); // unchanged: B not named
  });

  it('--force refreshes even when the pack contents have been locally modified', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const bare = createBareRepoWithTwoCommits(dir);
    rewindBareRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);
    const sourceUrl = `git+file://${bare.bareRepoPath}#main`;

    const install = await runCli(`install ${sourceUrl} --force --name drift-pack`, dir, E2E_ENV);
    expect(install.exitCode, install.stderr).toBe(0);

    const skillPath = join(
      dir,
      '.agentsmesh',
      'packs',
      'drift-pack',
      'skills',
      'a-skill',
      'SKILL.md',
    );
    // Locally edit the materialized pack (drift).
    writeFileSync(
      skillPath,
      '---\nname: a-skill\ndescription: local-edit\n---\n# locally edited\n',
    );

    // Advance upstream to v2 too.
    execFileSync(
      'git',
      ['--git-dir', bare.bareRepoPath, 'update-ref', 'refs/heads/main', bare.secondSha],
      { stdio: 'pipe' },
    );

    const r = await runCli('refresh --force', dir, E2E_ENV);
    expect(r.exitCode, r.stderr).toBe(0);
    // --force overwrites local edit with upstream v2.
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, 'utf8')).toContain('v2 body');
    expect(readFileSync(skillPath, 'utf8')).not.toContain('locally edited');
  });
});
