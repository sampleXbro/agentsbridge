import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject } from './helpers/canonical.js';
import { cleanup } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { fileNotExists } from './helpers/assertions.js';

describe('stale artifact cleanup e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it.each([
    {
      label: 'commands',
      target: 'cursor',
      features: '[rules, commands]',
      canonicalPath: '.agentsmesh/commands',
      stale: ['.cursor/commands/review.md'],
    },
    {
      label: 'agents',
      target: 'claude-code',
      features: '[rules, agents]',
      canonicalPath: '.agentsmesh/agents',
      stale: ['.claude/agents/code-reviewer.md', '.claude/agents/researcher.md'],
    },
    {
      label: 'hooks',
      target: 'copilot',
      features: '[rules, hooks]',
      canonicalPath: '.agentsmesh/hooks.yaml',
      stale: ['.github/hooks/agentsmesh.json', '.github/hooks/scripts/posttooluse-0.sh'],
    },
    {
      label: 'mcp',
      target: 'windsurf',
      features: '[rules, mcp]',
      canonicalPath: '.agentsmesh/mcp.json',
      stale: ['.windsurf/mcp_config.example.json'],
    },
    {
      label: 'ignore',
      target: 'claude-code',
      features: '[rules, ignore]',
      canonicalPath: '.agentsmesh/ignore',
      stale: ['.claudeignore'],
    },
    {
      label: 'permissions',
      target: 'gemini-cli',
      features: '[rules, permissions]',
      canonicalPath: '.agentsmesh/permissions.yaml',
      stale: ['.gemini/policies/permissions.toml'],
    },
  ])(
    'deletes stale %s artifacts after canonical removal',
    async ({ target, features, canonicalPath, stale }) => {
      dir = createCanonicalProject(`version: 1
targets: [${target}]
features: ${features}
`);

      expect((await runCli(`generate --targets ${target}`, dir)).exitCode).toBe(0);
      rmSync(join(dir, canonicalPath), { recursive: true, force: true });

      const rerun = await runCli(`generate --targets ${target}`, dir);
      expect(rerun.exitCode, rerun.stderr).toBe(0);

      for (const stalePath of stale) fileNotExists(join(dir, stalePath));
    },
  );
});
