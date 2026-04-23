import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { readJson, readText, readYaml } from './helpers/assertions.js';

function writeProject(dir: string, target: string): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    `version: 1\ntargets: [${target}]\nfeatures: [rules, permissions]\n`,
  );
  writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
  writeFileSync(
    join(dir, '.agentsmesh', 'permissions.yaml'),
    [
      'allow:',
      '  - Read',
      '  - Bash(pnpm test:*)',
      '  - Read',
      'deny:',
      '  - Read(./.env)',
      '  - Bash(curl:*)',
      '  - Read(./.env)',
      '',
    ].join('\n'),
  );
}

describe('permissions round-trip e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('round-trips Claude permissions with duplicate entry ordering preserved', async () => {
    dir = createTestProject();
    writeProject(dir, 'claude-code');

    expect((await runCli('generate --targets claude-code', dir)).exitCode).toBe(0);
    expect(readJson(join(dir, '.claude', 'settings.json'))).toMatchObject({
      permissions: {
        allow: ['Read', 'Bash(pnpm test:*)'],
        deny: ['Read(./.env)', 'Bash(curl:*)'],
      },
    });

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    expect((await runCli('import --from claude-code', dir)).exitCode).toBe(0);
    expect(readYaml(join(dir, '.agentsmesh', 'permissions.yaml'))).toMatchObject({
      allow: ['Read', 'Bash(pnpm test:*)'],
      deny: ['Read(./.env)', 'Bash(curl:*)'],
    });
  });

  it('round-trips Gemini permissions with duplicate entry ordering preserved', async () => {
    dir = createTestProject();
    writeProject(dir, 'gemini-cli');

    expect((await runCli('generate --targets gemini-cli', dir)).exitCode).toBe(0);
    const generated = readText(join(dir, '.gemini', 'policies', 'permissions.toml'));
    expect(generated).toContain('priority = 100');
    expect(generated).toContain('toolName = "read_file"');
    expect(generated).toContain('priority = 101');
    expect(generated).toContain('commandPrefix = "pnpm test"');

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    expect((await runCli('import --from gemini-cli', dir)).exitCode).toBe(0);
    expect(readYaml(join(dir, '.agentsmesh', 'permissions.yaml'))).toMatchObject({
      allow: ['Read', 'Bash(pnpm test:*)'],
      deny: ['Read(./.env)', 'Bash(curl:*)'],
    });
  });

  it('shows Cursor partial-support behavior after re-import instead of inventing a projection', async () => {
    dir = createTestProject();
    writeProject(dir, 'cursor');

    const lintBefore = await runCli('lint --targets cursor', dir);
    expect(lintBefore.stdout + lintBefore.stderr).toContain(
      'Cursor permissions are partial; tool-level allow/deny may lose fidelity.',
    );

    expect((await runCli('generate --targets cursor', dir)).exitCode).toBe(0);
    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    expect((await runCli('import --from cursor', dir)).exitCode).toBe(0);
    expect(existsSync(join(dir, '.agentsmesh', 'permissions.yaml'))).toBe(false);
  });
});
