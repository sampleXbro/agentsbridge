import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromQwenCode } from '../../../../src/targets/qwen-code/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `qwen-code-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromQwenCode', () => {
  it('imports QWEN.md as root rule', async () => {
    const root = setupFixture({
      'QWEN.md': '# Project Instructions\n\nUse TDD always.',
    });

    const results = await importFromQwenCode(root);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('qwen-code');

    rmSync(root, { recursive: true, force: true });
  });

  it('imports .qwen/rules/<slug>.md as additional rules', async () => {
    const root = setupFixture({
      '.qwen/rules/typescript.md':
        '---\ndescription: TypeScript rules\n---\n\nUse strict mode.',
    });

    const results = await importFromQwenCode(root);

    const ruleResult = results.find(
      (r) => r.feature === 'rules' && r.toPath.includes('typescript'),
    );
    expect(ruleResult).toBeDefined();
    expect(ruleResult!.fromTool).toBe('qwen-code');

    rmSync(root, { recursive: true, force: true });
  });

  it('imports .qwen/commands/<name>.md as canonical commands', async () => {
    const root = setupFixture({
      '.qwen/commands/review.md':
        '---\ndescription: Review code\n---\n\nReview the current file.',
    });

    const results = await importFromQwenCode(root);

    const cmdResult = results.find((r) => r.feature === 'commands');
    expect(cmdResult).toBeDefined();
    expect(cmdResult!.fromTool).toBe('qwen-code');
    expect(cmdResult!.toPath).toContain('review');

    rmSync(root, { recursive: true, force: true });
  });

  it('imports .qwen/agents/<name>.md as canonical agents', async () => {
    const root = setupFixture({
      '.qwen/agents/researcher.md':
        '---\nname: researcher\ndescription: Research agent\n---\n\nYou are a researcher.',
    });

    const results = await importFromQwenCode(root);

    const agentResult = results.find((r) => r.feature === 'agents');
    expect(agentResult).toBeDefined();
    expect(agentResult!.fromTool).toBe('qwen-code');
    expect(agentResult!.toPath).toContain('researcher');

    rmSync(root, { recursive: true, force: true });
  });

  it('imports .qwen/skills/<name>/SKILL.md as canonical skills', async () => {
    const root = setupFixture({
      '.qwen/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.qwen/skills/debugging/references/checklist.md': '# Checklist\n\n- Reproduce',
    });

    const results = await importFromQwenCode(root);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('qwen-code');

    rmSync(root, { recursive: true, force: true });
  });

  it('imports MCP from .qwen/settings.json mcpServers', async () => {
    const root = setupFixture({
      '.qwen/settings.json': JSON.stringify({
        mcpServers: {
          context7: {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
          },
        },
      }),
    });

    const results = await importFromQwenCode(root);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('qwen-code');

    rmSync(root, { recursive: true, force: true });
  });

  it('imports .qwenignore as canonical ignore', async () => {
    const root = setupFixture({
      '.qwenignore': '.env\nnode_modules/\ndist/',
    });

    const results = await importFromQwenCode(root);

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.fromTool).toBe('qwen-code');

    rmSync(root, { recursive: true, force: true });
  });

  it('returns empty results when no qwen-code config exists', async () => {
    const root = setupFixture({});
    const results = await importFromQwenCode(root);
    expect(results).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });
});
