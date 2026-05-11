import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromFactoryDroid } from '../../../../src/targets/factory-droid/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `factory-droid-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromFactoryDroid', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports AGENTS.md as root rule', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromFactoryDroid(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('factory-droid');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .factory/skills/', async () => {
    projectRoot = setupFixture({
      '.factory/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.factory/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromFactoryDroid(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('factory-droid');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from .factory/mcp.json', async () => {
    projectRoot = setupFixture({
      '.factory/mcp.json': JSON.stringify(
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

    const results = await importFromFactoryDroid(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('factory-droid');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no factory-droid config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromFactoryDroid(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in .factory/mcp.json', async () => {
    projectRoot = setupFixture({
      '.factory/mcp.json': '{ broken json',
    });

    const results = await importFromFactoryDroid(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty mcpServers object', async () => {
    projectRoot = setupFixture({
      '.factory/mcp.json': JSON.stringify({ mcpServers: {} }, null, 2),
    });

    const results = await importFromFactoryDroid(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles .factory/mcp.json without mcpServers key', async () => {
    projectRoot = setupFixture({
      '.factory/mcp.json': JSON.stringify({ otherConfig: true }, null, 2),
    });

    const results = await importFromFactoryDroid(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports from global scope using ~/.factory/ paths', async () => {
    projectRoot = setupFixture({
      '.factory/AGENTS.md': '# Global Factory Droid instructions',
      '.factory/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review\n---\n\n# Review',
      '.factory/mcp.json': JSON.stringify(
        { mcpServers: { fs: { command: 'node', args: ['fs.js'] } } },
        null,
        2,
      ),
    });

    const results = await importFromFactoryDroid(projectRoot, { scope: 'global' });
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.fromTool).toBe('factory-droid');

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
