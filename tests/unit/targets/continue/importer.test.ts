import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromContinue } from '../../../../src/targets/continue/importer.js';
import {
  CONTINUE_MCP_DIR,
  CONTINUE_PROMPTS_DIR,
  CONTINUE_RULES_DIR,
  CONTINUE_SKILLS_DIR,
} from '../../../../src/targets/continue/constants.js';

const TEST_DIR = join(tmpdir(), 'am-continue-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromContinue — rules', () => {
  it('imports .continue/rules/general.md as the canonical root rule', async () => {
    mkdirSync(join(TEST_DIR, CONTINUE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_RULES_DIR, 'general.md'),
      '---\nname: Project Rules\n---\n\nUse TypeScript.',
    );

    const results = await importFromContinue(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'continue',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TypeScript.');
  });

  it('imports legacy .continue/rules/_root.md as the canonical root rule', async () => {
    mkdirSync(join(TEST_DIR, CONTINUE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_RULES_DIR, '_root.md'),
      '---\nname: Project Rules\n---\n\nUse TypeScript.',
    );

    const results = await importFromContinue(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'continue',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TypeScript.');
  });

  it('imports non-command .continue/rules/*.md as canonical scoped rules', async () => {
    mkdirSync(join(TEST_DIR, CONTINUE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_RULES_DIR, 'typescript.md'),
      '---\ndescription: TS\nglobs:\n  - src/**/*.ts\n---\n\nUse strict TypeScript.',
    );

    const results = await importFromContinue(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      toPath: '.agentsmesh/rules/typescript.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('src/**/*.ts');
  });
});

describe('importFromContinue — commands', () => {
  it('imports .continue/prompts/*.md files as canonical commands', async () => {
    mkdirSync(join(TEST_DIR, CONTINUE_PROMPTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_PROMPTS_DIR, 'review.md'),
      [
        '---',
        'description: Review current changes',
        'x-agentsmesh-kind: command',
        'x-agentsmesh-name: review',
        'x-agentsmesh-allowed-tools:',
        '  - Read',
        '  - Bash(git diff)',
        '---',
        '',
        'Review the current diff for risk.',
        '',
      ].join('\n'),
    );

    const results = await importFromContinue(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'continue',
      toPath: '.agentsmesh/commands/review.md',
      feature: 'commands',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Review current changes');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('Bash(git diff)');
  });
});

describe('importFromContinue — mcp', () => {
  it('imports .continue/mcpServers/*.json into canonical mcp.json', async () => {
    mkdirSync(join(TEST_DIR, CONTINUE_MCP_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_MCP_DIR, 'servers.json'),
      JSON.stringify(
        {
          mcpServers: {
            context7: { type: 'stdio', command: 'npx', args: ['-y', '@ctx/mcp'], env: {} },
          },
        },
        null,
        2,
      ),
    );

    const results = await importFromContinue(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'continue',
      toPath: '.agentsmesh/mcp.json',
      feature: 'mcp',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(content).toContain('context7');
    expect(content).toContain('@ctx/mcp');
  });
});

describe('importFromContinue — skills', () => {
  it('imports .continue/skills into canonical skills with supporting files', async () => {
    mkdirSync(join(TEST_DIR, CONTINUE_SKILLS_DIR, 'api-gen', 'references'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CONTINUE_SKILLS_DIR, 'api-gen', 'SKILL.md'),
      '---\ndescription: API Gen\n---\n\nUse references/checklist.md.',
    );
    writeFileSync(
      join(TEST_DIR, CONTINUE_SKILLS_DIR, 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    const results = await importFromContinue(TEST_DIR);
    expect(results.filter((result) => result.feature === 'skills')).toHaveLength(2);
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'), 'utf-8'),
    ).toContain('description: API Gen');
    expect(
      readFileSync(
        join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'references', 'checklist.md'),
        'utf-8',
      ),
    ).toContain('# Checklist');
  });
});
