import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

describe('claude-code global layout — paths', () => {
  const layout = getTargetLayout('claude-code', 'global')!;

  it('resolves rule path to .claude/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.claude/rules/typescript.md');
  });

  it('resolves command path to .claude/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.claude/commands/deploy.md');
  });

  it('resolves agent path to .claude/agents/', () => {
    expect(
      layout.paths.agentPath('reviewer', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.claude/agents/reviewer.md');
  });
});

describe('claude-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('claude-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .mcp.json to .claude.json', () => {
    expect(rewrite('.mcp.json')).toBe('.claude.json');
  });

  it('keeps CLAUDE.md unchanged (already in global form)', () => {
    expect(rewrite('.claude/CLAUDE.md')).toBe('.claude/CLAUDE.md');
  });

  it('keeps .claude/rules/ paths unchanged', () => {
    expect(rewrite('.claude/rules/typescript.md')).toBe('.claude/rules/typescript.md');
  });

  it('keeps .claude/commands/ paths unchanged', () => {
    expect(rewrite('.claude/commands/deploy.md')).toBe('.claude/commands/deploy.md');
  });

  it('keeps .claude/agents/ paths unchanged', () => {
    expect(rewrite('.claude/agents/reviewer.md')).toBe('.claude/agents/reviewer.md');
  });

  it('keeps .claude/skills/ paths unchanged', () => {
    expect(rewrite('.claude/skills/ts-pro/SKILL.md')).toBe('.claude/skills/ts-pro/SKILL.md');
  });

  it('keeps .claude/settings.json unchanged', () => {
    expect(rewrite('.claude/settings.json')).toBe('.claude/settings.json');
  });

  it('keeps .claudeignore unchanged', () => {
    expect(rewrite('.claudeignore')).toBe('.claudeignore');
  });
});

describe('claude-code global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-claude-code-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['claude-code'],
      features: ['rules', 'skills'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    } as ValidatedConfig;
  }

  function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
      ...overrides,
    };
  }

  it('preserves skill frontmatter in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
            name: 'debugging',
            description: 'Debug workflow',
            body: '# Debugging\n\nReproduce first.',
            supportingFiles: [],
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const skill = results.find(
      (r) => r.target === 'claude-code' && r.path === '.claude/skills/debugging/SKILL.md',
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('preserves rule frontmatter in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/ts.md',
            root: false,
            targets: [],
            description: 'TypeScript standards',
            globs: ['src/**/*.ts'],
            body: 'Use strict mode.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rule = results.find(
      (r) => r.target === 'claude-code' && r.path === '.claude/rules/ts.md',
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('description: TypeScript standards');
    expect(rule!.content).toContain('src/**/*.ts');
    expect(rule!.content).toContain('Use strict mode.');
  });

  it('preserves MCP content in global mode (written to .claude.json)', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['mcp'] } as ValidatedConfig,
      canonical: makeCanonical({
        mcp: {
          mcpServers: {
            'test-server': { type: 'stdio', command: 'npx', args: ['-y', '@test/mcp'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const mcpFile = results.find((r) => r.target === 'claude-code' && r.path === '.claude.json');
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcpServers');
    const servers = parsed.mcpServers as Record<string, unknown>;
    expect(servers).toHaveProperty('test-server');
    const server = servers['test-server'] as Record<string, unknown>;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@test/mcp']);
  });

  it('preserves hooks configuration in global mode', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['hooks'] } as ValidatedConfig,
      canonical: makeCanonical({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              type: 'command' as const,
              command: './scripts/validate.sh',
              timeout: 30,
            },
          ],
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const hooksFile = results.find(
      (r) => r.target === 'claude-code' && r.path === '.claude/hooks.json',
    );
    expect(hooksFile).toBeDefined();
    const parsed = JSON.parse(hooksFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('PreToolUse');
    const entries = parsed.PreToolUse as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.matcher).toBe('Bash');
    const hooks = entries[0]!.hooks as Array<Record<string, unknown>>;
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.type).toBe('command');
    expect(hooks[0]!.command).toBe('./scripts/validate.sh');
    expect(hooks[0]!.timeout).toBe(30);
  });
});
