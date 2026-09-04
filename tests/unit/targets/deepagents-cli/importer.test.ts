import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromDeepagentsCli } from '../../../../src/targets/deepagents-cli/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `deepagents-cli-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absPath = join(root, relativePath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }
  return root;
}

describe('importFromDeepagentsCli', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports .deepagents/AGENTS.md as root rule', async () => {
    projectRoot = setupFixture({
      '.deepagents/AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromDeepagentsCli(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('deepagents-cli');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .deepagents/skills/', async () => {
    projectRoot = setupFixture({
      '.deepagents/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.deepagents/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromDeepagentsCli(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('deepagents-cli');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from .mcp.json', async () => {
    projectRoot = setupFixture({
      '.mcp.json': JSON.stringify(
        {
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            },
          },
        },
        null,
        2,
      ),
    });

    const results = await importFromDeepagentsCli(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('deepagents-cli');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromDeepagentsCli(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in .mcp.json', async () => {
    projectRoot = setupFixture({
      '.mcp.json': '{ broken json',
    });

    const results = await importFromDeepagentsCli(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty mcpServers object', async () => {
    projectRoot = setupFixture({
      '.mcp.json': JSON.stringify({ mcpServers: {} }, null, 2),
    });

    const results = await importFromDeepagentsCli(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports root rule and skills from global scope paths (per-agent-instance)', async () => {
    projectRoot = setupFixture({
      '.deepagents/agent/AGENTS.md': '# Global Instructions\n\nApply everywhere.',
      '.deepagents/agent/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review workflow\n---\n\n# Review\n\nCheck everything.',
    });

    const results = await importFromDeepagentsCli(projectRoot, { scope: 'global' });

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.fromTool).toBe('deepagents-cli');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports native subagents from .deepagents/agents/', async () => {
    projectRoot = setupFixture({
      '.deepagents/agents/researcher/AGENTS.md':
        '---\nname: researcher\ndescription: Research agent\nmodel: claude-sonnet\n---\n\nResearch topics thoroughly.',
    });

    const results = await importFromDeepagentsCli(projectRoot);

    const agentResult = results.find((r) => r.feature === 'agents');
    expect(agentResult).toBeDefined();
    expect(agentResult!.fromTool).toBe('deepagents-cli');
    expect(agentResult!.toPath).toBe('.agentsmesh/agents/researcher.md');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports native subagents from global scope (.deepagents/agent/agents/)', async () => {
    projectRoot = setupFixture({
      '.deepagents/agent/agents/researcher/AGENTS.md':
        '---\nname: researcher\ndescription: Research agent\n---\n\nResearch topics thoroughly.',
    });

    const results = await importFromDeepagentsCli(projectRoot, { scope: 'global' });

    const agentResult = results.find((r) => r.feature === 'agents');
    expect(agentResult).toBeDefined();
    expect(agentResult!.toPath).toBe('.agentsmesh/agents/researcher.md');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports shell.allow_list from global .deepagents/config.toml', async () => {
    projectRoot = setupFixture({
      '.deepagents/config.toml': '[shell]\nallow_list = [ "npm run test" ]\n',
    });

    const results = await importFromDeepagentsCli(projectRoot, { scope: 'global' });

    const permissionResult = results.find((r) => r.feature === 'permissions');
    expect(permissionResult).toBeDefined();
    expect(permissionResult!.toPath).toBe('.agentsmesh/permissions.yaml');
    expect(permissionResult!.fromTool).toBe('deepagents-cli');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('ignores config.toml at project scope (config.toml is global-only)', async () => {
    projectRoot = setupFixture({
      '.deepagents/config.toml': '[shell]\nallow_list = [ "npm run test" ]\n',
    });

    const results = await importFromDeepagentsCli(projectRoot);

    expect(results.filter((r) => r.feature === 'permissions')).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
