import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

function git(args: string[], cwd: string): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'AgentsMesh Tests',
      GIT_AUTHOR_EMAIL: 'tests@example.com',
      GIT_COMMITTER_NAME: 'AgentsMesh Tests',
      GIT_COMMITTER_EMAIL: 'tests@example.com',
    },
  });
}

function writeCanonicalSource(
  root: string,
  body: string,
  hook: string,
  permission: string,
  mcp: string,
): void {
  mkdirSync(join(root, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(root, '.agentsmesh', 'rules', '_root.md'),
    `---\nroot: true\n---\n# ${body}\n`,
  );
  writeFileSync(
    join(root, '.agentsmesh', 'hooks.yaml'),
    `PostToolUse:\n  - matcher: Write\n    command: ${hook}\n`,
  );
  writeFileSync(
    join(root, '.agentsmesh', 'permissions.yaml'),
    `allow:\n  - Read\n  - ${permission}\n`,
  );
  writeFileSync(
    join(root, '.agentsmesh', 'mcp.json'),
    JSON.stringify({ mcpServers: { context7: { command: mcp, args: [] } } }, null, 2),
  );
}

describe('multi-extend precedence e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('applies remote base, then shared local, then project overrides with dedupe', async () => {
    dir = createTestProject();
    const remoteRepo = join(dir, 'remote-repo');
    const shared = join(dir, 'shared');
    const project = join(dir, 'project');

    writeCanonicalSource(remoteRepo, 'Remote Base', 'echo remote', 'Bash(remote:*)', 'remote-mcp');
    git(['init', '--initial-branch=main'], remoteRepo);
    git(['add', '.'], remoteRepo);
    git(['commit', '-m', 'init'], remoteRepo);

    writeCanonicalSource(shared, 'Shared Base', 'echo shared', 'Bash(shared:*)', 'shared-mcp');

    mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(project, 'agentsmesh.yaml'),
      [
        'version: 1',
        'targets: [claude-code]',
        'features: [rules, hooks, permissions, mcp]',
        'extends:',
        '  - name: remote-base',
        `    source: git+file://${remoteRepo}#main`,
        '    features: [rules, hooks, permissions, mcp]',
        '  - name: shared-base',
        '    source: ../shared',
        '    features: [rules, hooks, permissions, mcp]',
        '',
      ].join('\n'),
    );
    writeCanonicalSource(
      project,
      'Project Override',
      'echo project',
      'Bash(project:*)',
      'project-mcp',
    );

    const result = await runCli('generate', project);
    expect(result.exitCode, result.stderr).toBe(0);

    expect(readFileSync(join(project, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Project Override',
    );

    const settings = JSON.parse(
      readFileSync(join(project, '.claude', 'settings.json'), 'utf-8'),
    ) as {
      permissions: { allow: string[] };
      hooks: { PostToolUse: Array<{ hooks: Array<{ command: string }> }> };
    };
    const mcp = JSON.parse(readFileSync(join(project, '.mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, { command: string }>;
    };
    expect(settings.permissions.allow).toEqual([
      'Read',
      'Bash(remote:*)',
      'Bash(shared:*)',
      'Bash(project:*)',
    ]);
    expect(settings.hooks.PostToolUse).toEqual([
      { matcher: 'Write', hooks: [{ type: 'command', command: 'echo project' }] },
    ]);
    expect(mcp.mcpServers.context7.command).toBe('project-mcp');
    expect(readFileSync(join(project, '.agentsmesh', '.lock'), 'utf-8')).toContain('remote-base');
    expect(readFileSync(join(project, '.agentsmesh', '.lock'), 'utf-8')).toContain('shared-base');
  });
});
