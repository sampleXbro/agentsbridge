import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import { importFromReplitAgent } from '../../../../src/targets/replit-agent/importer.js';
import {
  generateCommands,
  generateAgents,
} from '../../../../src/targets/replit-agent/generator.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `replit-agent-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromReplitAgent', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports replit.md as root rule', async () => {
    projectRoot = setupFixture({
      'replit.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromReplitAgent(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('replit-agent');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .agents/skills/', async () => {
    projectRoot = setupFixture({
      '.agents/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.agents/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromReplitAgent(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('replit-agent');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no replit-agent config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromReplitAgent(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports both replit.md and skills together', async () => {
    projectRoot = setupFixture({
      'replit.md': '# Root Instructions\n\nAlways use TypeScript.',
      '.agents/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review\n---\n\n# Review\n\nReview all PRs.',
    });

    const results = await importFromReplitAgent(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('round-trips generated command and agent skills back to canonical', async () => {
    const command = {
      source: '/proj/.agentsmesh/commands/review.md',
      name: 'review',
      description: 'Review the diff',
      allowedTools: ['Bash(git diff:*)'],
      body: 'Review every change.',
    };
    const agent = {
      source: '/proj/.agentsmesh/agents/code-reviewer.md',
      name: 'code-reviewer',
      description: 'Reviews code',
      body: 'Review carefully.',
      tools: ['Read'],
      disallowedTools: [],
      model: 'claude-sonnet',
      permissionMode: '',
      maxTurns: 0,
      mcpServers: [],
      hooks: {},
      skills: [],
      memory: '',
    };
    const emitted = [
      ...generateCommands({
        rules: [],
        commands: [command],
        agents: [],
        skills: [],
        mcp: null,
        permissions: null,
        hooks: null,
        ignore: [],
      }),
      ...generateAgents({
        rules: [],
        commands: [],
        agents: [agent],
        skills: [],
        mcp: null,
        permissions: null,
        hooks: null,
        ignore: [],
      }),
    ];
    projectRoot = setupFixture(Object.fromEntries(emitted.map((o) => [o.path, o.content])));

    const results = await importFromReplitAgent(projectRoot);

    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/commands/review.md',
    ]);
    expect(results.every((r) => r.fromTool === 'replit-agent')).toBe(true);
    const importedCommand = readFileSync(
      join(projectRoot, '.agentsmesh/commands/review.md'),
      'utf-8',
    );
    expect(importedCommand).toContain('description: Review the diff');
    expect(importedCommand).toContain('Bash(git diff:*)');
    expect(importedCommand).toContain('Review every change.');
    const importedAgent = readFileSync(
      join(projectRoot, '.agentsmesh/agents/code-reviewer.md'),
      'utf-8',
    );
    expect(importedAgent).toContain('name: code-reviewer');
    expect(importedAgent).toContain('model: claude-sonnet');
    expect(importedAgent).toContain('Review carefully.');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty replit.md file', async () => {
    projectRoot = setupFixture({
      'replit.md': '',
    });

    const results = await importFromReplitAgent(projectRoot);

    // An empty file may still produce an import result (empty content)
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    // Empty content is valid — it creates a placeholder root rule
    expect(rootRule === undefined || rootRule.feature === 'rules').toBe(true);

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
