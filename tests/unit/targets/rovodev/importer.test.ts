import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromRovodev } from '../../../../src/targets/rovodev/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `rovodev-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromRovodev', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports AGENTS.md as root rule', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromRovodev(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('rovodev');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .rovodev/skills/', async () => {
    projectRoot = setupFixture({
      '.rovodev/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.rovodev/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromRovodev(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('rovodev');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from .rovodev/mcp.json', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp.json': JSON.stringify(
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

    const results = await importFromRovodev(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('rovodev');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no rovodev config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromRovodev(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in .rovodev/mcp.json', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp.json': '{ broken json',
    });

    const results = await importFromRovodev(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty mcpServers object', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp.json': JSON.stringify({ mcpServers: {} }, null, 2),
    });

    const results = await importFromRovodev(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports all features together', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Instructions\n\nFollow standards.',
      '.rovodev/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review\n---\n\n# Review',
      '.rovodev/mcp.json': JSON.stringify(
        { mcpServers: { fs: { command: 'node', args: ['fs.js'] } } },
        null,
        2,
      ),
    });

    const results = await importFromRovodev(projectRoot);

    const features = new Set(results.map((r) => r.feature));
    expect(features.has('rules')).toBe(true);
    expect(features.has('skills')).toBe(true);
    expect(features.has('mcp')).toBe(true);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('uses project scope by default', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Project scope test',
    });

    const results = await importFromRovodev(projectRoot);
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('accepts explicit project scope', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Explicit project scope test',
    });

    const results = await importFromRovodev(projectRoot, { scope: 'project' });
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports from global scope using ~/.rovodev/ paths', async () => {
    projectRoot = setupFixture({
      '.rovodev/AGENTS.md': '# Global Rovo Dev instructions',
      '.rovodev/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review\n---\n\n# Review',
    });

    const results = await importFromRovodev(projectRoot, { scope: 'global' });
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.fromTool).toBe('rovodev');

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
