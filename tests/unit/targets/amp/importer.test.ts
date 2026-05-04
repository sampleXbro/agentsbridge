import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromAmp } from '../../../../src/targets/amp/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `amp-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromAmp', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports AGENTS.md as root rule', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromAmp(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('amp');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .agents/skills/', async () => {
    projectRoot = setupFixture({
      '.agents/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.agents/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromAmp(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('amp');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from .amp/settings.json', async () => {
    projectRoot = setupFixture({
      '.amp/settings.json': JSON.stringify(
        {
          'amp.mcpServers': {
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

    const results = await importFromAmp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('amp');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no amp config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromAmp(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles .amp/settings.json without MCP servers', async () => {
    projectRoot = setupFixture({
      '.amp/settings.json': JSON.stringify({ 'amp.tools.disable': ['WebSearch'] }, null, 2),
    });

    const results = await importFromAmp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in .amp/settings.json', async () => {
    projectRoot = setupFixture({
      '.amp/settings.json': '{ broken json',
    });

    const results = await importFromAmp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty mcpServers object', async () => {
    projectRoot = setupFixture({
      '.amp/settings.json': JSON.stringify({ 'amp.mcpServers': {} }, null, 2),
    });

    const results = await importFromAmp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP using mcpServers key fallback', async () => {
    projectRoot = setupFixture({
      '.amp/settings.json': JSON.stringify(
        {
          mcpServers: {
            playwright: { command: 'npx', args: ['-y', '@playwright/mcp'] },
          },
        },
        null,
        2,
      ),
    });

    const results = await importFromAmp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('amp');

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
