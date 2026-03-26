import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
let testDir = '';

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
    '---\nroot: true\n---\n# Shared remote root\n',
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

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'ab-extends-integration-'));
  mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
});

afterEach(() => {
  if (testDir) rmSync(testDir, { recursive: true, force: true });
  testDir = '';
});

describe('generate with remote extends', () => {
  it('deduplicates permissions merged from a git remote extend and local canonical files', () => {
    const remoteRepo = createRemoteRepo(testDir);

    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Local root\n',
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'permissions.yaml'),
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
      join(testDir, 'agentsmesh.yaml'),
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

    execFileSync('node', [CLI_PATH, 'generate'], { cwd: testDir, stdio: 'pipe' });

    const settings = JSON.parse(
      readFileSync(join(testDir, '.claude', 'settings.json'), 'utf-8'),
    ) as {
      permissions: { allow: string[]; deny: string[] };
    };

    expect(settings.permissions.allow).toEqual([
      'Bash(pnpm build:*)',
      'Bash(pnpm test:*)',
      'Bash(git add:*)',
      'Bash(npx vitest:*)',
    ]);
  });
});
