import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromZed } from '../../../../src/targets/zed/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `zed-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromZed', () => {
  it('imports .rules as root rule', async () => {
    const projectRoot = setupFixture({
      '.rules': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromZed(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('zed');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from .zed/settings.json', async () => {
    const projectRoot = setupFixture({
      '.zed/settings.json': JSON.stringify(
        {
          context_servers: {
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

    const results = await importFromZed(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('zed');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no zed config exists', async () => {
    const projectRoot = setupFixture({});
    const results = await importFromZed(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles .zed/settings.json without context_servers', async () => {
    const projectRoot = setupFixture({
      '.zed/settings.json': JSON.stringify(
        { agent: { default_model: { provider: 'zed.dev', model: 'claude-sonnet-4-5' } } },
        null,
        2,
      ),
    });

    const results = await importFromZed(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in .zed/settings.json', async () => {
    const projectRoot = setupFixture({
      '.zed/settings.json': '{ broken json',
    });

    const results = await importFromZed(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty context_servers object', async () => {
    const projectRoot = setupFixture({
      '.zed/settings.json': JSON.stringify({ context_servers: {} }, null, 2),
    });

    const results = await importFromZed(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('strips source field from imported MCP servers', async () => {
    const projectRoot = setupFixture({
      '.zed/settings.json': JSON.stringify(
        {
          context_servers: {
            myserver: {
              source: 'custom',
              command: 'npx',
              args: ['-y', 'my-mcp-server'],
            },
          },
        },
        null,
        2,
      ),
    });

    const results = await importFromZed(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
