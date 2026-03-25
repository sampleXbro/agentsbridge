import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRemoteExtend,
  parseGitSource,
  parseGitlabSource,
} from '../../../src/config/remote-fetcher.js';

const TEST_ROOT = join(tmpdir(), 'agentsbridge-remote-fetcher-git-test');

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'AgentsBridge Tests',
      GIT_AUTHOR_EMAIL: 'tests@example.com',
      GIT_COMMITTER_NAME: 'AgentsBridge Tests',
      GIT_COMMITTER_EMAIL: 'tests@example.com',
    },
  }).trim();
}

function createRemoteRepo(root: string, withCanonical = true): string {
  const repoDir = join(root, 'remote-repo');
  mkdirSync(repoDir, { recursive: true });
  if (withCanonical) {
    mkdirSync(join(repoDir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(repoDir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Remote git root\n',
    );
    writeFileSync(
      join(repoDir, '.agentsbridge', 'permissions.yaml'),
      'allow:\n  - Bash(pnpm build:*)\n  - Bash(pnpm test:*)\n',
    );
  } else {
    writeFileSync(join(repoDir, 'README.md'), '# no canonical files\n');
  }

  git(['init', '--initial-branch=main'], repoDir);
  git(['add', '.'], repoDir);
  git(['commit', '-m', 'init'], repoDir);
  return repoDir;
}

beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('parseGitlabSource', () => {
  it('parses gitlab namespace and ref', () => {
    expect(parseGitlabSource('gitlab:group/subgroup/project@v1.2.3')).toEqual({
      namespace: 'group/subgroup',
      project: 'project',
      ref: 'v1.2.3',
      cloneUrl: 'https://gitlab.com/group/subgroup/project.git',
    });
  });
});

describe('parseGitSource', () => {
  it('parses git+file source with explicit ref', () => {
    expect(parseGitSource('git+file:///tmp/example.git#main')).toEqual({
      url: 'file:///tmp/example.git',
      ref: 'main',
    });
  });
});

describe('fetchRemoteExtend generic git', () => {
  it('clones and resolves a git+file extend from a local repository', async () => {
    const repoDir = createRemoteRepo(TEST_ROOT);
    const cacheDir = join(TEST_ROOT, 'cache');

    const result = await fetchRemoteExtend(`git+file://${repoDir}#main`, 'git-file-extend', {
      cacheDir,
    });

    expect(result.version).toMatch(/^[0-9a-f]{40}$/);
    expect(result.resolvedPath).not.toBe(repoDir);
    expect(result.resolvedPath).toContain('git_file');
  });

  it('reuses the cached clone when refresh is not requested', async () => {
    const repoDir = createRemoteRepo(TEST_ROOT);
    const cacheDir = join(TEST_ROOT, 'cache');
    const source = `git+file://${repoDir}#main`;

    const first = await fetchRemoteExtend(source, 'git-file-extend', { cacheDir });
    rmSync(repoDir, { recursive: true, force: true });

    const second = await fetchRemoteExtend(source, 'git-file-extend', { cacheDir });

    expect(second.resolvedPath).toBe(first.resolvedPath);
    expect(second.version).toBe(first.version);
  });

  it('falls back to the cached clone when a refresh fetch fails', async () => {
    const repoDir = createRemoteRepo(TEST_ROOT);
    const cacheDir = join(TEST_ROOT, 'cache');
    const source = `git+file://${repoDir}#main`;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = await fetchRemoteExtend(source, 'git-file-extend', { cacheDir });
    rmSync(repoDir, { recursive: true, force: true });

    const second = await fetchRemoteExtend(source, 'git-file-extend', {
      cacheDir,
      refresh: true,
    });

    expect(second.resolvedPath).toBe(first.resolvedPath);
    expect(second.version).toBe(first.version);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using cached version'));
  });

  it('fetches and caches a native-format repo without .agentsbridge/ without throwing', async () => {
    const repoDir = createRemoteRepo(TEST_ROOT, /* withCanonical= */ false);
    const cacheDir = join(TEST_ROOT, 'cache-native');

    const result = await fetchRemoteExtend(`git+file://${repoDir}`, 'native-extend', { cacheDir });

    expect(result.resolvedPath).toBeTruthy();
    const { existsSync } = await import('node:fs');
    // Native-format file present in fetched repo
    expect(existsSync(join(result.resolvedPath, 'README.md'))).toBe(true);
    // No .agentsbridge/ required — detection happens in extends.ts, not here
  });

  it('returns the same cached path on a second call without re-cloning', async () => {
    const repoDir = createRemoteRepo(TEST_ROOT, false);
    const cacheDir = join(TEST_ROOT, 'cache-reuse');

    const first = await fetchRemoteExtend(`git+file://${repoDir}`, 'native-extend', { cacheDir });
    const second = await fetchRemoteExtend(`git+file://${repoDir}`, 'native-extend', { cacheDir });

    // Both calls return the same path — cache was reused
    expect(second.resolvedPath).toBe(first.resolvedPath);
  });
});
