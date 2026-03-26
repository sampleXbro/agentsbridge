import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromJunie } from '../../../../src/targets/junie/importer.js';
import {
  JUNIE_AGENTS_FALLBACK,
  JUNIE_COMMANDS_DIR,
  JUNIE_AGENTS_DIR,
  JUNIE_CI_GUIDELINES,
  JUNIE_GUIDELINES,
  JUNIE_IGNORE,
  JUNIE_MCP_FILE,
  JUNIE_SKILLS_DIR,
} from '../../../../src/targets/junie/constants.js';

const TEST_DIR = join(tmpdir(), 'ab-junie-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromJunie — rules', () => {
  it('imports .junie/guidelines.md as canonical root rule', async () => {
    mkdirSync(join(TEST_DIR, '.junie'), { recursive: true });
    writeFileSync(join(TEST_DIR, JUNIE_GUIDELINES), '# Junie Guidelines\n\nUse TDD.');

    const results = await importFromJunie(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'junie',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'root: true',
    );
  });

  it('imports .junie/AGENTS.md when the default guidelines file is absent', async () => {
    mkdirSync(join(TEST_DIR, '.junie'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.junie', 'AGENTS.md'),
      '# Preferred Guidelines\n\nKeep it simple.',
    );

    const results = await importFromJunie(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'junie',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'Keep it simple.',
    );
  });

  it('falls back to AGENTS.md when guidelines.md is absent', async () => {
    writeFileSync(join(TEST_DIR, JUNIE_AGENTS_FALLBACK), '# Fallback\n');
    const results = await importFromJunie(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]?.fromPath).toContain(JUNIE_AGENTS_FALLBACK);
  });

  it('falls back to .junie/ci-guidelines.md when AGENTS.md and guidelines.md are absent', async () => {
    mkdirSync(join(TEST_DIR, '.junie'), { recursive: true });
    writeFileSync(join(TEST_DIR, JUNIE_CI_GUIDELINES), '# CI Guidelines\n');
    const results = await importFromJunie(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]?.fromPath).toContain(JUNIE_CI_GUIDELINES);
  });
});

describe('importFromJunie — mcp and ignore', () => {
  it('imports Junie project mcp.json into canonical mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.junie', 'mcp'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, JUNIE_MCP_FILE),
      JSON.stringify(
        { mcpServers: { context7: { command: 'npx', args: ['-y', '@ctx/mcp'], env: {} } } },
        null,
        2,
      ),
    );

    const results = await importFromJunie(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      toPath: '.agentsmesh/mcp.json',
      feature: 'mcp',
    });
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')).toContain('context7');
  });

  it('imports .aiignore into canonical ignore', async () => {
    writeFileSync(join(TEST_DIR, JUNIE_IGNORE), '.env\nnode_modules/\n');
    const results = await importFromJunie(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      toPath: '.agentsmesh/ignore',
      feature: 'ignore',
    });
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8')).toContain('.env');
  });
});

describe('importFromJunie — skills', () => {
  it('imports .junie/skills into canonical skills with supporting files', async () => {
    mkdirSync(join(TEST_DIR, JUNIE_SKILLS_DIR, 'api-gen', 'references'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, JUNIE_SKILLS_DIR, 'api-gen', 'SKILL.md'),
      '---\ndescription: API Gen\n---\n\nUse references/checklist.md.',
    );
    writeFileSync(
      join(TEST_DIR, JUNIE_SKILLS_DIR, 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    const results = await importFromJunie(TEST_DIR);
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

describe('importFromJunie — commands and agents', () => {
  it('imports .junie/commands/*.md into canonical commands', async () => {
    mkdirSync(join(TEST_DIR, JUNIE_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, JUNIE_COMMANDS_DIR, 'review.md'),
      '---\ndescription: Review command\nallowed-tools:\n  - Read\n---\n\nRun review flow.',
    );

    const results = await importFromJunie(TEST_DIR);
    expect(results.filter((result) => result.feature === 'commands')).toHaveLength(1);
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8')).toContain(
      'description: Review command',
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8')).toContain(
      'Run review flow.',
    );
  });

  it('imports .junie/agents/*.md into canonical agents', async () => {
    mkdirSync(join(TEST_DIR, JUNIE_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, JUNIE_AGENTS_DIR, 'security-reviewer.md'),
      '---\ndescription: Security specialist\ntools:\n  - Read\nmodel: gpt-5\n---\n\nReview security issues.',
    );

    const results = await importFromJunie(TEST_DIR);
    expect(results.filter((result) => result.feature === 'agents')).toHaveLength(1);
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'security-reviewer.md'), 'utf-8'),
    ).toContain('description: Security specialist');
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'security-reviewer.md'), 'utf-8'),
    ).toContain('Review security issues.');
  });
});
