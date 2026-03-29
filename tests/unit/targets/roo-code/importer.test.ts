import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromRooCode } from '../../../../src/targets/roo-code/importer.js';
import {
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_ROOT_RULE,
  ROO_CODE_ROOT_RULE_FALLBACK,
} from '../../../../src/targets/roo-code/constants.js';

const TEST_DIR = join(tmpdir(), 'am-roo-code-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromRooCode — root rule', () => {
  it('imports .roo/rules/00-root.md as canonical root rule', async () => {
    mkdirSync(join(TEST_DIR, ROO_CODE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, ROO_CODE_ROOT_RULE), '# Roo Instructions\n\nUse TDD.');

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TDD.');
  });

  it('falls back to .roorules when .roo/rules/ has no 00-root.md', async () => {
    writeFileSync(join(TEST_DIR, ROO_CODE_ROOT_RULE_FALLBACK), '# Fallback root\n');

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
  });
});

describe('importFromRooCode — non-root rules', () => {
  it('imports other .roo/rules/ files as canonical non-root rules', async () => {
    mkdirSync(join(TEST_DIR, ROO_CODE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, ROO_CODE_ROOT_RULE), '# Root');
    writeFileSync(join(TEST_DIR, `${ROO_CODE_RULES_DIR}/typescript.md`), 'Use strict TS.');

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/typescript.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('Use strict TS.');
  });
});

describe('importFromRooCode — per-mode rules', () => {
  it('imports .roo/rules-{mode}/ as regular canonical rules', async () => {
    mkdirSync(join(TEST_DIR, '.roo', 'rules-code'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.roo', 'rules-code', 'severity.md'), 'Severity rules here.');

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.feature === 'rules')).toBe(true);
    const ruleResult = results.find((r) => r.toPath.includes('severity'));
    expect(ruleResult).toBeDefined();
  });
});

describe('importFromRooCode — commands', () => {
  it('imports .roo/commands/*.md as canonical commands', async () => {
    mkdirSync(join(TEST_DIR, ROO_CODE_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, `${ROO_CODE_COMMANDS_DIR}/review.md`),
      '---\ndescription: Review command\n---\n\nReview all files.',
    );

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/commands/review.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('Review all files.');
  });
});

describe('importFromRooCode — MCP', () => {
  it('imports .roo/mcp.json as canonical mcp', async () => {
    mkdirSync(join(TEST_DIR, '.roo'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ROO_CODE_MCP_FILE),
      JSON.stringify({
        mcpServers: {
          'test-server': { command: 'node', args: ['server.js'] },
        },
      }),
    );

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['test-server']).toBeDefined();
  });
});

describe('importFromRooCode — ignore', () => {
  it('imports .rooignore as canonical ignore', async () => {
    writeFileSync(join(TEST_DIR, ROO_CODE_IGNORE), '.env\nnode_modules/\n');

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/ignore')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('.env');
    expect(content).toContain('node_modules/');
  });
});

describe('importFromRooCode — skills', () => {
  it('imports .roo/skills/{name}/SKILL.md', async () => {
    mkdirSync(join(TEST_DIR, ROO_CODE_SKILLS_DIR, 'typescript-pro'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ROO_CODE_SKILLS_DIR, 'typescript-pro', 'SKILL.md'),
      '---\nname: typescript-pro\ndescription: Advanced TypeScript\n---\n\n# TypeScript Pro',
    );

    const results = await importFromRooCode(TEST_DIR);
    expect(results.some((r) => r.feature === 'skills')).toBe(true);
  });
});

describe('importFromRooCode — empty project', () => {
  it('returns empty array when no roo-code files exist', async () => {
    const results = await importFromRooCode(TEST_DIR);
    expect(results).toEqual([]);
  });
});
