import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromAntigravity } from '../../../../src/targets/antigravity/importer.js';
import {
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR,
} from '../../../../src/targets/antigravity/constants.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromAntigravity — rules', () => {
  it('imports .agents/rules/general.md as canonical root rule', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, ANTIGRAVITY_RULES_ROOT), '# Project Rules\n\nUse TDD.');

    const results = await importFromAntigravity(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'antigravity',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'root: true',
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'Use TDD.',
    );
  });

  it('imports legacy .agents/rules/_root.md as canonical root when general.md is absent', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, ANTIGRAVITY_RULES_DIR, '_root.md'), '# Legacy Root\n\nBody.');

    const results = await importFromAntigravity(TEST_DIR);
    expect(results.filter((r) => r.feature === 'rules')).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'antigravity',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'Body.',
    );
  });

  it('imports non-root rules from .agents/rules/ (excluding general.md and _root.md)', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, ANTIGRAVITY_RULES_ROOT), '# Root\n');
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_RULES_DIR, 'typescript.md'),
      '# TypeScript Rules\n\nUse strict mode.',
    );

    const results = await importFromAntigravity(TEST_DIR);
    const tsResult = results.find((r) => r.toPath === '.agentsmesh/rules/typescript.md');
    expect(tsResult).toBeDefined();
    expect(tsResult?.feature).toBe('rules');
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8'),
    ).toContain('strict mode');
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8'),
    ).toContain('root: false');
  });

  it('returns empty when no .agents/rules/ directory exists', async () => {
    const results = await importFromAntigravity(TEST_DIR);
    expect(results).toHaveLength(0);
  });
});

describe('importFromAntigravity — workflows (commands)', () => {
  it('imports .agents/workflows/*.md as canonical commands', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_WORKFLOWS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_WORKFLOWS_DIR, 'review.md'),
      'Review the current diff for quality.',
    );

    const results = await importFromAntigravity(TEST_DIR);
    expect(results.filter((r) => r.feature === 'commands')).toHaveLength(1);
    const canonical = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(canonical).toContain('Review the current diff for quality.');
  });
});

describe('importFromAntigravity — skills', () => {
  it('imports .agents/skills/ into canonical skills with supporting files', async () => {
    mkdirSync(join(TEST_DIR, ANTIGRAVITY_SKILLS_DIR, 'typescript-pro', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_SKILLS_DIR, 'typescript-pro', 'SKILL.md'),
      '---\ndescription: Advanced TypeScript\n---\n\nUse advanced patterns.',
    );
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_SKILLS_DIR, 'typescript-pro', 'references', 'advanced-types.md'),
      '# Advanced Types\n',
    );

    const results = await importFromAntigravity(TEST_DIR);
    expect(results.filter((r) => r.feature === 'skills')).toHaveLength(2);
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'skills', 'typescript-pro', 'SKILL.md'), 'utf-8'),
    ).toContain('description: Advanced TypeScript');
    expect(
      readFileSync(
        join(
          TEST_DIR,
          '.agentsmesh',
          'skills',
          'typescript-pro',
          'references',
          'advanced-types.md',
        ),
        'utf-8',
      ),
    ).toContain('# Advanced Types');
  });
});

describe('importFromAntigravity — global scope', () => {
  it('imports ~/.gemini/antigravity/GEMINI.md, global workflows, skills, and mcp_config.json (not project .agents/workflows)', async () => {
    mkdirSync(join(TEST_DIR, '.gemini', 'antigravity', 'skills', 'review'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.gemini', 'antigravity', 'workflows'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.gemini', 'antigravity', 'GEMINI.md'), '# Global root\n');
    writeFileSync(
      join(TEST_DIR, '.gemini', 'antigravity', 'workflows', 'review.md'),
      '---\ndescription: Review workflow\n---\n\nReview the diff.',
    );
    writeFileSync(
      join(TEST_DIR, '.gemini', 'antigravity', 'skills', 'review', 'SKILL.md'),
      '---\ndescription: Review\n---\n# Skill body',
    );
    writeFileSync(
      join(TEST_DIR, '.gemini', 'antigravity', 'mcp_config.json'),
      JSON.stringify({ mcpServers: { x: { command: 'npx', args: [] } } }, null, 2),
    );
    mkdirSync(join(TEST_DIR, '.agents', 'workflows'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agents', 'workflows', 'ship.md'), 'ship it');

    const results = await importFromAntigravity(TEST_DIR, { scope: 'global' });

    expect(
      results.some(
        (r) => r.feature === 'commands' && r.fromPath.includes(ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR),
      ),
    ).toBe(true);
    expect(results.some((r) => r.fromPath.includes('.agents/workflows'))).toBe(false);
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'Global root',
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8')).toContain(
      'Review the diff',
    );
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'skills', 'review', 'SKILL.md'), 'utf-8'),
    ).toContain('Skill body');
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')).toContain(
      'mcpServers',
    );
  });
});
