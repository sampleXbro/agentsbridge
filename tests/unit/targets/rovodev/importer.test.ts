import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { importFromRovodev } from '../../../../src/targets/rovodev/importer.js';
import { generateCommands } from '../../../../src/targets/rovodev/generator.js';

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

  it('imports commands from .rovodev/prompts.yml', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml':
        'prompts:\n  - name: review\n    description: Review code\n    content_file: commands/review.md\n',
      '.rovodev/commands/review.md': 'Review current changes for quality.\n',
    });

    const results = await importFromRovodev(projectRoot);

    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult!.fromTool).toBe('rovodev');
    expect(commandResult!.toPath).toBe('.agentsmesh/commands/review.md');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('ignores malformed YAML in .rovodev/prompts.yml', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml': ': not: valid: yaml: [',
    });

    const results = await importFromRovodev(projectRoot);

    expect(results.some((r) => r.feature === 'commands')).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('ignores prompts.yml that parses to a non-object (bare scalar)', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml': 'null',
    });

    const results = await importFromRovodev(projectRoot);

    expect(results.some((r) => r.feature === 'commands')).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('ignores prompts.yml whose "prompts" key is not an array', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml': 'prompts: not-an-array\n',
    });

    const results = await importFromRovodev(projectRoot);

    expect(results.some((r) => r.feature === 'commands')).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports a prompt entry with no description key (falls back to empty)', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml': 'prompts:\n  - name: nodesc\n    content_file: commands/nodesc.md\n',
      '.rovodev/commands/nodesc.md': 'No description on this one.\n',
    });

    const results = await importFromRovodev(projectRoot);

    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult!.toPath).toBe('.agentsmesh/commands/nodesc.md');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('skips prompt entries missing a name or content_file', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml':
        'prompts:\n  - description: No name or content_file\n  - name: no-content-file\n',
    });

    const results = await importFromRovodev(projectRoot);

    expect(results.some((r) => r.feature === 'commands')).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('skips a prompt entry whose content_file is missing on disk', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml':
        'prompts:\n  - name: ghost\n    description: Missing file\n    content_file: commands/ghost.md\n',
    });

    const results = await importFromRovodev(projectRoot);

    expect(results.some((r) => r.feature === 'commands')).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no rovodev config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromRovodev(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('does not import project-level .rovodev/mcp.json (no longer a supported source)', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp.json': JSON.stringify(
        { mcpServers: { filesystem: { command: 'npx', args: ['-y', 'x'] } } },
        null,
        2,
      ),
    });

    const results = await importFromRovodev(projectRoot);

    expect(results.some((r) => r.feature === 'mcp')).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports MCP from ~/.rovodev/mcp_config.json at global scope', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp_config.json': JSON.stringify(
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

    const results = await importFromRovodev(projectRoot, { scope: 'global' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('rovodev');
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles malformed JSON in ~/.rovodev/mcp_config.json', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp_config.json': '{ broken json',
    });

    const results = await importFromRovodev(projectRoot, { scope: 'global' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty mcpServers object at global scope', async () => {
    projectRoot = setupFixture({
      '.rovodev/mcp_config.json': JSON.stringify({ mcpServers: {} }, null, 2),
    });

    const results = await importFromRovodev(projectRoot, { scope: 'global' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports all features together', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Instructions\n\nFollow standards.',
      '.rovodev/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review\n---\n\n# Review',
      '.rovodev/prompts.yml':
        'prompts:\n  - name: deploy\n    description: Deploy\n    content_file: commands/deploy.md\n',
      '.rovodev/commands/deploy.md': 'Deploy the current release.\n',
    });

    const results = await importFromRovodev(projectRoot);

    const features = new Set(results.map((r) => r.feature));
    expect(features.has('rules')).toBe(true);
    expect(features.has('skills')).toBe(true);
    expect(features.has('commands')).toBe(true);

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

  it('imports commands from ~/.rovodev/prompts.yml at global scope', async () => {
    projectRoot = setupFixture({
      '.rovodev/prompts.yml':
        'prompts:\n  - name: standup\n    description: Daily standup\n    content_file: commands/standup.md\n',
      '.rovodev/commands/standup.md': 'Summarize yesterday and today.\n',
    });

    const results = await importFromRovodev(projectRoot, { scope: 'global' });
    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult!.toPath).toBe('.agentsmesh/commands/standup.md');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('round-trips a canonical command through generate -> write -> import (name/description/body survive)', async () => {
    const canonical: CanonicalFiles = {
      rules: [],
      commands: [
        {
          name: 'review',
          source: '/proj/.agentsmesh/commands/review.md',
          description: 'Review code changes',
          body: 'Run a thorough code review.',
          allowedTools: [],
        },
      ],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };

    const outputs = generateCommands(canonical);
    projectRoot = setupFixture(Object.fromEntries(outputs.map((o) => [o.path, o.content])));

    const results = await importFromRovodev(projectRoot);
    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult!.toPath).toBe('.agentsmesh/commands/review.md');

    const imported = readFileSync(join(projectRoot, '.agentsmesh/commands/review.md'), 'utf-8');
    expect(imported).toContain('description: Review code changes');
    expect(imported).toContain('Run a thorough code review.');

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
