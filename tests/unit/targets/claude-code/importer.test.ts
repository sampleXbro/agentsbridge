import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromClaudeCode } from '../../../../src/targets/claude-code/importer.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-import-claude-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromClaudeCode — rules', () => {
  it('imports .claude/CLAUDE.md to .agentsmesh/rules/_root.md (primary path)', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Project Rules\n\nUse TypeScript.');
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      fromPath: join(TEST_DIR, '.claude', 'CLAUDE.md'),
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Project Rules');
    expect(content).toContain('Use TypeScript.');
  });

  it('imports CLAUDE.md (legacy fallback) when .claude/CLAUDE.md absent', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Legacy Root\n\nOld project.');
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      fromPath: join(TEST_DIR, 'CLAUDE.md'),
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Legacy Root');
  });

  it('imports .claude/rules/*.md to .agentsmesh/rules/*.md', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'rules', 'typescript.md'),
      '---\ndescription: TS rules\nglobs: src/**/*.ts\n---\n\nUse strict mode.',
    );
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      toPath: '.agentsmesh/rules/typescript.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('Use strict mode.');
  });

  it('imports .claude/CLAUDE.md and .claude/rules together', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Root\n');
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'rules', 'extra.md'), '# Extra\n');
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.toPath).sort();
    expect(paths).toEqual(['.agentsmesh/rules/_root.md', '.agentsmesh/rules/extra.md']);
  });

  it('returns empty array when no Claude Code config found', async () => {
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toEqual([]);
  });

  it('adds root frontmatter to .claude/CLAUDE.md when it has none', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'Plain content.');
    await importFromClaudeCode(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toMatch(/---[\s\S]*?root:\s*true/);
  });
});

describe('importFromClaudeCode — commands', () => {
  it('imports .claude/commands/*.md to .agentsmesh/commands/*.md', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'commands', 'review.md'),
      '---\ndescription: Run code review\nallowed-tools:\n  - Read\n  - Grep\n---\n\nReview changes.',
    );
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      toPath: '.agentsmesh/commands/review.md',
      feature: 'commands',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Run code review');
    expect(content).toContain('Review changes.');
  });

  it('imports multiple command files', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), '# Review\n');
    writeFileSync(join(TEST_DIR, '.claude', 'commands', 'deploy.md'), '# Deploy\n');
    const results = await importFromClaudeCode(TEST_DIR);
    const commandResults = results.filter((r) => r.feature === 'commands');
    expect(commandResults).toHaveLength(2);
    const paths = commandResults.map((r) => r.toPath).sort();
    expect(paths).toEqual(['.agentsmesh/commands/deploy.md', '.agentsmesh/commands/review.md']);
  });
});

describe('importFromClaudeCode — agents', () => {
  it('imports .claude/agents/*.md to .agentsmesh/agents/*.md', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'agents', 'code-reviewer.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\ntools:\n  - Read\n  - Grep\nmodel: sonnet\n---\n\nYou are an expert reviewer.',
    );
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      toPath: '.agentsmesh/agents/code-reviewer.md',
      feature: 'agents',
    });
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(content).toContain('name: code-reviewer');
    expect(content).toContain('You are an expert reviewer.');
  });
});

describe('importFromClaudeCode — skills', () => {
  it('imports .claude/skills/{name}/SKILL.md to .agentsmesh/skills/{name}/SKILL.md', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'skills', 'api-gen', 'SKILL.md'),
      '---\ndescription: Generate REST APIs\n---\n\nWhen creating APIs, check patterns.',
    );
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      toPath: '.agentsmesh/skills/api-gen/SKILL.md',
      feature: 'skills',
    });
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Generate REST APIs');
    expect(content).toContain('When creating APIs');
  });

  it('imports SKILL.md and supporting files', async () => {
    mkdirSync(join(TEST_DIR, '.claude', 'skills', 'my-skill'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'skills', 'my-skill', 'SKILL.md'),
      '---\ndescription: My skill\n---\n\nSkill body.',
    );
    writeFileSync(
      join(TEST_DIR, '.claude', 'skills', 'my-skill', 'template.ts'),
      'export const x = 1;',
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults).toHaveLength(2);
    const paths = skillResults.map((r) => r.toPath).sort();
    expect(paths).toContain('.agentsmesh/skills/my-skill/SKILL.md');
    expect(paths).toContain('.agentsmesh/skills/my-skill/template.ts');
    const ts = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'my-skill', 'template.ts'),
      'utf-8',
    );
    expect(ts).toBe('export const x = 1;');
  });
});

describe('importFromClaudeCode — settings.json decomposition', () => {
  it('imports mcpServers to .agentsmesh/mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {},
          },
        },
      }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult?.toPath).toBe('.agentsmesh/mcp.json');
    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(mcp.mcpServers.context7).toBeDefined();
  });

  it('imports permissions to .agentsmesh/permissions.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Read', 'Grep'], deny: ['WebFetch'] },
      }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeDefined();
    expect(permResult?.toPath).toBe('.agentsmesh/permissions.yaml');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(content).toContain('allow');
    expect(content).toContain('Read');
    expect(content).toContain('deny');
    expect(content).toContain('WebFetch');
  });

  it('imports hooks to .agentsmesh/hooks.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write|Edit',
              hooks: [{ type: 'command', command: 'prettier --write $FILE_PATH' }],
            },
          ],
        },
      }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const hooksResult = results.find((r) => r.feature === 'hooks');
    expect(hooksResult).toBeDefined();
    expect(hooksResult?.toPath).toBe('.agentsmesh/hooks.yaml');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(content).toContain('PostToolUse');
    expect(content).toContain('Write|Edit');
    expect(content).toContain('prettier');
  });

  it('decomposes settings.json with all three sections', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: { ctx: { type: 'stdio', command: 'npx', args: [], env: {} } },
        permissions: { allow: ['Read'], deny: [] },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: './validate.sh', timeout: 30 }],
            },
          ],
        },
      }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const features = results.map((r) => r.feature);
    expect(features).toContain('mcp');
    expect(features).toContain('permissions');
    expect(features).toContain('hooks');
  });

  it('skips settings.json when malformed JSON', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'settings.json'), 'NOT JSON {{{');
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(0);
    expect(results.filter((r) => r.feature === 'permissions')).toHaveLength(0);
    expect(results.filter((r) => r.feature === 'hooks')).toHaveLength(0);
  });

  it('skips permissions section when empty allow and deny', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: [], deny: [] } }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results.filter((r) => r.feature === 'permissions')).toHaveLength(0);
  });
});

describe('importFromClaudeCode — .mcp.json', () => {
  it('imports .mcp.json to .agentsmesh/mcp.json', async () => {
    writeFileSync(
      join(TEST_DIR, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          context7: { type: 'stdio', command: 'npx', args: ['-y', '@ctx/mcp'], env: {} },
        },
      }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult?.toPath).toBe('.agentsmesh/mcp.json');
    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(mcp.mcpServers.context7).toBeDefined();
  });

  it('prefers .mcp.json over .claude/settings.json mcpServers', async () => {
    writeFileSync(
      join(TEST_DIR, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          fromMcpJson: { type: 'stdio', command: 'npx', args: [], env: {} },
        },
      }),
    );
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: {
          fromSettings: { type: 'stdio', command: 'npx', args: [], env: {} },
        },
      }),
    );
    const results = await importFromClaudeCode(TEST_DIR);
    const mcpResults = results.filter((r) => r.feature === 'mcp');
    expect(mcpResults).toHaveLength(1);
    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(mcp.mcpServers.fromMcpJson).toBeDefined();
    expect(mcp.mcpServers.fromSettings).toBeUndefined();
  });
});

describe('importFromClaudeCode — .claudeignore', () => {
  it('imports .claudeignore to .agentsmesh/ignore', async () => {
    writeFileSync(join(TEST_DIR, '.claudeignore'), 'node_modules\ndist\n.env\n');
    const results = await importFromClaudeCode(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'claude-code',
      toPath: '.agentsmesh/ignore',
      feature: 'ignore',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('dist');
    expect(content).toContain('.env');
  });
});

describe('importFromClaudeCode — full fidelity', () => {
  it('imports all Claude Code config in a single call', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Root\n');
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'rules', 'ts.md'), '# TS\n');
    mkdirSync(join(TEST_DIR, '.claude', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), '# Review\n');
    mkdirSync(join(TEST_DIR, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'agents', 'reviewer.md'), '# Reviewer\n');
    mkdirSync(join(TEST_DIR, '.claude', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'skills', 'api-gen', 'SKILL.md'), '# API gen\n');
    writeFileSync(join(TEST_DIR, '.claudeignore'), 'dist\n');
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: { ctx: { type: 'stdio', command: 'npx', args: [], env: {} } },
        permissions: { allow: ['Read'], deny: ['WebFetch'] },
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'prettier --write $FILE_PATH' }],
            },
          ],
        },
      }),
    );

    const results = await importFromClaudeCode(TEST_DIR);
    const features = [...new Set(results.map((r) => r.feature))].sort();
    expect(features).toEqual(
      ['agents', 'commands', 'hooks', 'ignore', 'mcp', 'permissions', 'rules', 'skills'].sort(),
    );
    expect(results.length).toBeGreaterThanOrEqual(8);
  });
});
