import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromWarp } from '../../../../src/targets/warp/importer.js';
import { generateMcp } from '../../../../src/targets/warp/generator.js';
import { WARP_GLOBAL_MCP_FILE } from '../../../../src/targets/warp/constants.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

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

  it('does not import project .mcp.json under global scope', async () => {
    projectRoot = setupFixture({
      '.mcp.json': JSON.stringify(
        { mcpServers: { filesystem: { command: 'npx', args: [] } } },
        null,
        2,
      ),
    });

    const results = await importFromWarp(projectRoot, { scope: 'global' });

    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from ~/.warp/.mcp.json under global scope', async () => {
    projectRoot = setupFixture({
      [WARP_GLOBAL_MCP_FILE]: JSON.stringify(
        {
          mcpServers: {
            context7: { command: 'npx', args: ['-y', 'context7'] },
          },
        },
        null,
        2,
      ),
    });

    const results = await importFromWarp(projectRoot, { scope: 'global' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('warp');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');
    expect(mcpResult!.fromPath).toMatch(/\.warp\/\.mcp\.json$/);

    rmSync(projectRoot, { recursive: true, force: true });
  });
});

describe('warp global MCP round-trip', () => {
  function makeCanonical(): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: {
        mcpServers: {
          context7: { type: 'stdio', command: 'npx', args: ['-y', 'context7'], env: {} },
        },
      },
      permissions: null,
      hooks: null,
      ignore: [],
    };
  }

  it('generate --global → import --global round-trips mcpServers back to canonical', async () => {
    const root = join(tmpdir(), `warp-rt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(root, '.warp'), { recursive: true });
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });

    // Generate the global MCP file from canonical.
    const outputs = generateMcp(makeCanonical(), { capability: { level: 'native' }, scope: 'global' });
    expect(outputs).toHaveLength(1);
    expect(outputs[0].path).toBe(WARP_GLOBAL_MCP_FILE);
    writeFileSync(join(root, outputs[0].path), outputs[0].content, 'utf-8');

    // Import it back.
    const results = await importFromWarp(root, { scope: 'global' });
    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();

    const imported = JSON.parse(readFileSync(join(root, '.agentsmesh/mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(imported.mcpServers.context7.command).toBe('npx');
    expect(imported.mcpServers.context7.args).toEqual(['-y', 'context7']);

    rmSync(root, { recursive: true, force: true });
  });
});
