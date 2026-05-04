import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromWarp } from '../../../../src/targets/warp/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `warp-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromWarp', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports AGENTS.md as root rule', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromWarp(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('warp');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports WARP.md as root rule (legacy)', async () => {
    projectRoot = setupFixture({
      'WARP.md': '# Legacy Warp Instructions\n\nUse strict mode.',
    });

    const results = await importFromWarp(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromPath).toMatch(/WARP\.md$/);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('prefers WARP.md over AGENTS.md when both exist', async () => {
    projectRoot = setupFixture({
      'WARP.md': '# Legacy rules from WARP.md',
      'AGENTS.md': '# Rules from AGENTS.md',
    });

    const results = await importFromWarp(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.fromPath).toMatch(/WARP\.md$/);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .warp/skills/', async () => {
    projectRoot = setupFixture({
      '.warp/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.warp/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromWarp(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('warp');

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

    const results = await importFromWarp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('warp');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no warp config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromWarp(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in .mcp.json', async () => {
    projectRoot = setupFixture({
      '.mcp.json': '{ broken json',
    });

    const results = await importFromWarp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty mcpServers object', async () => {
    projectRoot = setupFixture({
      '.mcp.json': JSON.stringify({ mcpServers: {} }, null, 2),
    });

    const results = await importFromWarp(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
