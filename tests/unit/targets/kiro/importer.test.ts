import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromKiro } from '../../../../src/targets/kiro/importer.js';
import {
  KIRO_AGENTS_MD,
  KIRO_AGENTS_DIR,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_MCP_FILE,
  KIRO_IGNORE,
  KIRO_HOOKS_DIR,
} from '../../../../src/targets/kiro/constants.js';

const TEST_DIR = join(tmpdir(), 'am-kiro-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromKiro — rules', () => {
  it('imports AGENTS.md as the canonical root rule', async () => {
    writeFileSync(join(TEST_DIR, KIRO_AGENTS_MD), '# Kiro root\n\nUse TDD.');

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((result) => result.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TDD.');
  });

  it('imports steering files with inclusion metadata into canonical rules', async () => {
    mkdirSync(join(TEST_DIR, KIRO_STEERING_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_STEERING_DIR, 'typescript.md'),
      '---\ninclusion: fileMatch\nfileMatchPattern: src/**/*.ts\ndescription: TypeScript rules\n---\n\nUse strict TS.\n',
    );

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((result) => result.toPath === '.agentsmesh/rules/typescript.md')).toBe(
      true,
    );
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('globs:');
    expect(content).toContain('src/**/*.ts');
    expect(content).toContain('description: TypeScript rules');
  });
});

describe('importFromKiro — agents', () => {
  it('imports .kiro/agents/*.md into canonical agents', async () => {
    mkdirSync(join(TEST_DIR, KIRO_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_AGENTS_DIR, 'review-bot.md'),
      '---\nname: review-bot\ndescription: Review\n---\n\nBody.',
    );

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((r) => r.toPath === '.agentsmesh/agents/review-bot.md')).toBe(true);
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'review-bot.md'), 'utf-8'),
    ).toContain('Review');
  });
});

describe('importFromKiro — skills', () => {
  it('imports .kiro/skills/{name}/SKILL.md and supporting files', async () => {
    mkdirSync(join(TEST_DIR, KIRO_SKILLS_DIR, 'debugging', 'references'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_SKILLS_DIR, 'debugging', 'SKILL.md'),
      '---\nname: debugging\ndescription: Debug production failures\n---\n\n# Debugging',
    );
    writeFileSync(
      join(TEST_DIR, KIRO_SKILLS_DIR, 'debugging', 'references', 'checklist.md'),
      '# Checklist',
    );

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((result) => result.feature === 'skills')).toBe(true);
    expect(
      readFileSync(
        join(TEST_DIR, '.agentsmesh', 'skills', 'debugging', 'references', 'checklist.md'),
        'utf-8',
      ),
    ).toContain('Checklist');
  });
});

describe('importFromKiro — MCP', () => {
  it('imports .kiro/settings/mcp.json as canonical mcp', async () => {
    mkdirSync(join(TEST_DIR, '.kiro', 'settings'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_MCP_FILE),
      JSON.stringify({
        mcpServers: {
          github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
        },
      }),
    );

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((result) => result.toPath === '.agentsmesh/mcp.json')).toBe(true);
  });
});

describe('importFromKiro — hooks', () => {
  it('imports .kiro/hooks/*.kiro.hook into canonical hooks.yaml', async () => {
    mkdirSync(join(TEST_DIR, KIRO_HOOKS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KIRO_HOOKS_DIR, 'review-on-save.kiro.hook'),
      JSON.stringify({
        name: 'Review on save',
        version: '1',
        when: { type: 'preToolUse', tools: ['write'] },
        then: { type: 'askAgent', prompt: 'Review the updated file.' },
      }),
    );

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((result) => result.toPath === '.agentsmesh/hooks.yaml')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(content).toContain('PreToolUse');
    expect(content).toContain('matcher: write');
    expect(content).toContain('prompt: Review the updated file.');
  });

  it('ignores malformed hook JSON', async () => {
    mkdirSync(join(TEST_DIR, KIRO_HOOKS_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KIRO_HOOKS_DIR, 'broken.kiro.hook'), '{broken');

    const results = await importFromKiro(TEST_DIR);

    expect(results).toEqual([]);
  });
});

describe('importFromKiro — ignore', () => {
  it('imports .kiroignore as canonical ignore', async () => {
    writeFileSync(join(TEST_DIR, KIRO_IGNORE), '.env\ndist/\n');

    const results = await importFromKiro(TEST_DIR);

    expect(results.some((result) => result.toPath === '.agentsmesh/ignore')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('.env');
    expect(content).toContain('dist/');
  });
});
