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

  it('imports native commands from .factory/commands/', async () => {
    projectRoot = setupFixture({
      '.factory/commands/review.md':
        '---\ndescription: Review code changes\nallowed-tools:\n  - Bash\n  - Read\n---\n\nRun a code review.',
    });

    const results = await importFromFactoryDroid(projectRoot);

    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult!.toPath).toBe('.agentsmesh/commands/review.md');

    const { readFileSync } = await import('node:fs');
    const written = readFileSync(join(projectRoot, '.agentsmesh/commands/review.md'), 'utf-8');
    expect(written).toContain('description: Review code changes');
    expect(written).toContain('Run a code review.');

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

  it('imports agents (droids) from .factory/droids/', async () => {
    projectRoot = setupFixture({
      '.factory/droids/code-reviewer.md':
        '---\nname: code-reviewer\ndescription: Code review specialist\nmodel: sonnet\ntools:\n  - Read\n  - Glob\n  - Grep\n---\n\nYou are a code reviewer.',
    });

    const results = await importFromFactoryDroid(projectRoot);

    const agentResult = results.find((r) => r.feature === 'agents');
    expect(agentResult).toBeDefined();
    expect(agentResult!.fromTool).toBe('factory-droid');
    expect(agentResult!.toPath).toBe('.agentsmesh/agents/code-reviewer.md');

    const { readFileSync } = await import('node:fs');
    const written = readFileSync(join(projectRoot, '.agentsmesh/agents/code-reviewer.md'), 'utf-8');
    expect(written).toContain('name: code-reviewer');
    expect(written).toContain('description: Code review specialist');
    expect(written).toContain('model: sonnet');
    expect(written).toContain('Read');
    expect(written).toContain('You are a code reviewer.');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports agents (droids) from global scope', async () => {
    projectRoot = setupFixture({
      '.factory/droids/researcher.md':
        '---\nname: researcher\ndescription: Research specialist\nmodel: haiku\n---\n\nYou research things.',
    });

    const results = await importFromFactoryDroid(projectRoot, { scope: 'global' });

    const agentResult = results.find((r) => r.feature === 'agents');
    expect(agentResult).toBeDefined();
    expect(agentResult!.toPath).toBe('.agentsmesh/agents/researcher.md');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports hooks from .factory/hooks.json (wrapped) into .agentsmesh/hooks.yaml', async () => {
    projectRoot = setupFixture({
      '.factory/hooks.json': JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [{ type: 'command', command: 'prettier --write $FILE_PATH' }],
              },
            ],
          },
        },
        null,
        2,
      ),
    });

    const results = await importFromFactoryDroid(projectRoot);

    const hooksResult = results.find((r) => r.feature === 'hooks');
    expect(hooksResult).toBeDefined();
    expect(hooksResult!.fromTool).toBe('factory-droid');
    expect(hooksResult!.toPath).toBe('.agentsmesh/hooks.yaml');

    const { readFileSync } = await import('node:fs');
    const written = readFileSync(join(projectRoot, '.agentsmesh/hooks.yaml'), 'utf-8');
    expect(written).toContain('PostToolUse');
    expect(written).toContain('prettier --write $FILE_PATH');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('does not import hooks from the bare (unwrapped) shape', async () => {
    projectRoot = setupFixture({
      '.factory/hooks.json': JSON.stringify({
        PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'x' }] }],
      }),
    });

    const results = await importFromFactoryDroid(projectRoot);
    expect(results.find((r) => r.feature === 'hooks')).toBeUndefined();

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
