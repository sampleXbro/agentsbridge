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
});
