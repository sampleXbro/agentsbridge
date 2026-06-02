import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { ROO_CODE_GLOBAL_MCP_FILE } from '../../../../src/targets/roo-code/constants.js';

describe('roo-code global layout — paths', () => {
  const layout = getTargetLayout('roo-code', 'global')!;

  it('resolves rule path to .roo/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.roo/rules/typescript.md');
  });

  it('resolves command path to .roo/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.roo/commands/deploy.md');
  });

  it('suppresses agent path (returns null)', () => {
    expect(layout.paths.agentPath('my-agent', {} as never)).toBeNull();
  });
});

describe('roo-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('roo-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .roo/rules/00-root.md to .roo/AGENTS.md', () => {
    expect(rewrite('.roo/rules/00-root.md')).toBe('.roo/AGENTS.md');
  });

  it('keeps .roo/rules/ paths unchanged', () => {
    expect(rewrite('.roo/rules/typescript.md')).toBe('.roo/rules/typescript.md');
  });

  it('keeps .roo/commands/ paths unchanged', () => {
    expect(rewrite('.roo/commands/deploy.md')).toBe('.roo/commands/deploy.md');
  });

  it('keeps .roo/skills/ paths unchanged', () => {
    expect(rewrite('.roo/skills/ts-pro/SKILL.md')).toBe('.roo/skills/ts-pro/SKILL.md');
  });

  it('rewrites .roo/mcp.json to mcp_settings.json', () => {
    expect(rewrite('.roo/mcp.json')).toBe('mcp_settings.json');
  });

  it('keeps .rooignore unchanged', () => {
    expect(rewrite('.rooignore')).toBe('.rooignore');
  });

  it('suppresses .roomodes in global mode (returns null)', () => {
    expect(rewrite('.roomodes')).toBeNull();
  });
});

describe('roo-code global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('roo-code', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .roo/skills/ to .agents/skills/', () => {
    expect(mirror('.roo/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .roo/skills/', () => {
    expect(mirror('.roo/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.roo/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('.roo/AGENTS.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.roo/commands/commit.md', [])).toBeNull();
  });
});

describe('roo-code global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-roo-code-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['roo-code'],
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
      (r) => r.target === 'roo-code' && r.path === '.roo/skills/debugging/SKILL.md',
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('preserves rule content in global mode', async () => {
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

    const rule = results.find((r) => r.target === 'roo-code' && r.path === '.roo/rules/ts.md');
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use strict mode.');
  });

  it('preserves MCP configuration in global mode', async () => {
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

    const mcpFile = results.find(
      (r) => r.target === 'roo-code' && r.path === ROO_CODE_GLOBAL_MCP_FILE,
    );
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcpServers');
    const servers = parsed.mcpServers as Record<string, unknown>;
    expect(servers).toHaveProperty('test-server');
    const server = servers['test-server'] as Record<string, unknown>;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@test/mcp']);
  });
});
