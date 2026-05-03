import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromOpenCode } from '../../../../src/targets/opencode/importer.js';
import {
  OPENCODE_ROOT_RULE,
  OPENCODE_RULES_DIR,
  OPENCODE_COMMANDS_DIR,
  OPENCODE_AGENTS_DIR,
  OPENCODE_SKILLS_DIR,
  OPENCODE_CONFIG_FILE,
} from '../../../../src/targets/opencode/constants.js';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'am-opencode-importer-'));
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function toPaths(results: { toPath: string }[]): string[] {
  return results.map((result) => result.toPath).sort();
}

describe('importFromOpenCode — empty project', () => {
  it('returns empty array when no opencode files exist', async () => {
    const results = await importFromOpenCode(TEST_DIR);
    expect(results).toEqual([]);
  });
});

describe('importFromOpenCode — root rule', () => {
  it('imports AGENTS.md as canonical _root.md with root: true frontmatter', async () => {
    writeFileSync(join(TEST_DIR, OPENCODE_ROOT_RULE), '# OpenCode Project\n\nUse TDD.');

    const results = await importFromOpenCode(TEST_DIR);
    expect(toPaths(results)).toEqual(['.agentsmesh/rules/_root.md']);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TDD.');
  });

  it('strips the agentsmesh decoration paragraph on round-trip import', async () => {
    const decorated = [
      '# Root',
      '',
      'Project rules.',
      '',
      'For details, see the `.agentsmesh` directory at the project root.',
      '',
    ].join('\n');
    writeFileSync(join(TEST_DIR, OPENCODE_ROOT_RULE), decorated);

    const results = await importFromOpenCode(TEST_DIR);
    const rootResult = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');
    expect(rootResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('Project rules.');
  });
});

describe('importFromOpenCode — non-root rules', () => {
  it('imports .opencode/rules/<slug>.md', async () => {
    mkdirSync(join(TEST_DIR, OPENCODE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, OPENCODE_RULES_DIR, 'typescript.md'),
      '---\ndescription: TS rules\n---\n\nUse strict TS.',
    );

    const results = await importFromOpenCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/typescript.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('Use strict TS.');
  });

  it('preserves description and globs frontmatter', async () => {
    mkdirSync(join(TEST_DIR, OPENCODE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, OPENCODE_RULES_DIR, 'testing.md'),
      '---\ndescription: Testing rules\nglobs:\n  - "tests/**/*.ts"\n---\n\nWrite tests first.',
    );

    const results = await importFromOpenCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/testing.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'testing.md'), 'utf-8');
    expect(content).toContain('description: Testing rules');
  });
});

describe('importFromOpenCode — commands', () => {
  it('imports .opencode/commands/<name>.md', async () => {
    mkdirSync(join(TEST_DIR, OPENCODE_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, OPENCODE_COMMANDS_DIR, 'review.md'),
      '---\ndescription: Review code\n---\n\nReview all files.',
    );

    const results = await importFromOpenCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/commands/review.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('Review all files.');
  });
});

describe('importFromOpenCode — agents', () => {
  it('imports .opencode/agents/<slug>.md', async () => {
    mkdirSync(join(TEST_DIR, OPENCODE_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, OPENCODE_AGENTS_DIR, 'researcher.md'),
      '---\nmode: subagent\ndescription: Research specialist\nmodel: anthropic/claude-haiku-4-5\n---\n\nResearch docs.',
    );

    const results = await importFromOpenCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/researcher.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'researcher.md'), 'utf-8');
    expect(content).toContain('Research docs.');
  });
});

describe('importFromOpenCode — skills', () => {
  it('imports .opencode/skills/<name>/SKILL.md and supporting files', async () => {
    const skillDir = join(TEST_DIR, OPENCODE_SKILLS_DIR, 'api-gen');
    const refsDir = join(skillDir, 'references');
    mkdirSync(refsDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: api-gen\ndescription: Generate APIs\n---\n\n# API Generator',
    );
    writeFileSync(join(refsDir, 'checklist.md'), '# Checklist');
    writeFileSync(join(skillDir, 'template.ts'), 'export const t = 1;');

    const results = await importFromOpenCode(TEST_DIR);
    const skillPaths = toPaths(results).filter((p) => p.includes('skills/'));
    expect(skillPaths).toContain('.agentsmesh/skills/api-gen/SKILL.md');
    expect(skillPaths).toContain('.agentsmesh/skills/api-gen/references/checklist.md');
    expect(skillPaths).toContain('.agentsmesh/skills/api-gen/template.ts');
  });
});

describe('importFromOpenCode — MCP (custom opencode.json format)', () => {
  it('imports mcp key from opencode.json converting OpenCode format to canonical', async () => {
    const config = {
      mcp: {
        filesystem: {
          type: 'local',
          command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
          environment: {},
        },
        github: {
          type: 'local',
          command: ['npx', '-y', '@modelcontextprotocol/server-github'],
          environment: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        },
      },
    };
    writeFileSync(join(TEST_DIR, OPENCODE_CONFIG_FILE), JSON.stringify(config));

    const results = await importFromOpenCode(TEST_DIR);
    const mcpResult = results.find((r) => r.toPath === '.agentsmesh/mcp.json');
    expect(mcpResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(parsed.mcpServers.filesystem).toBeDefined();
    expect(parsed.mcpServers.filesystem.command).toBe('npx');
    expect(parsed.mcpServers.filesystem.args).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/workspace',
    ]);
    expect(parsed.mcpServers.github.env).toEqual({ GITHUB_TOKEN: '${GITHUB_TOKEN}' });
  });

  it('imports remote MCP servers with url', async () => {
    const config = {
      mcp: {
        remote: {
          type: 'remote',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
        },
      },
    };
    writeFileSync(join(TEST_DIR, OPENCODE_CONFIG_FILE), JSON.stringify(config));

    await importFromOpenCode(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(parsed.mcpServers.remote.url).toBe('https://example.com/mcp');
    expect(parsed.mcpServers.remote.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('skips MCP import when opencode.json has no mcp key', async () => {
    writeFileSync(join(TEST_DIR, OPENCODE_CONFIG_FILE), JSON.stringify({ model: 'gpt-4o' }));

    const results = await importFromOpenCode(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/mcp.json')).toBeUndefined();
  });

  it('skips MCP import when opencode.json does not exist', async () => {
    const results = await importFromOpenCode(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/mcp.json')).toBeUndefined();
  });
});
