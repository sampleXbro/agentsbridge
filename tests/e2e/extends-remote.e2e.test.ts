import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function createRemoteRepo(root: string): string {
  const repoDir = join(root, 'remote-repo');
  mkdirSync(join(repoDir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(repoDir, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Remote shared root\n',
  );
  writeFileSync(
    join(repoDir, '.agentsmesh', 'permissions.yaml'),
    ['allow:', '  - Bash(pnpm build:*)', '  - Bash(pnpm test:*)', '  - Bash(git add:*)', ''].join(
      '\n',
    ),
  );

  git(['init', '--initial-branch=main'], repoDir);
  git(['add', '.'], repoDir);
  git(['commit', '-m', 'init'], repoDir);
  return repoDir;
}

describe('remote git extends end to end', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('fetches a non-GitHub remote extend and avoids duplicate permissions in generated output', async () => {
    dir = createTestProject();
    const remoteRepo = createRemoteRepo(dir);

    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Local root wins\n',
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'permissions.yaml'),
      [
        'allow:',
        '  - Bash(pnpm build:*)',
        '  - Bash(pnpm test:*)',
        '  - Bash(git add:*)',
        '  - Bash(npx vitest:*)',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      [
        'version: 1',
        'targets: [claude-code]',
        'features: [rules, permissions]',
        'extends:',
        '  - name: remote-base',
        `    source: git+file://${remoteRepo}#main`,
        '    features: [rules, permissions]',
        '',
      ].join('\n'),
    );

    const result = await runCli('generate', dir);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8')).toContain('Local root wins');

    const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf-8')) as {
      permissions: { allow: string[]; deny: string[] };
    };
    expect(settings.permissions.allow).toEqual([
      'Bash(pnpm build:*)',
      'Bash(pnpm test:*)',
      'Bash(git add:*)',
      'Bash(npx vitest:*)',
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', '.lock'), 'utf-8')).toContain('remote-base');
  });
});
