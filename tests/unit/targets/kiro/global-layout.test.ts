import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  KIRO_GLOBAL_STEERING_DIR,
  KIRO_GLOBAL_SKILLS_DIR,
  KIRO_GLOBAL_MCP_FILE,
} from '../../../../src/targets/kiro/constants.js';

describe('kiro global layout — paths', () => {
  const layout = getTargetLayout('kiro', 'global')!;

  it('resolves rule path to .kiro/steering/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.kiro/steering/typescript.md');
  });

  it('returns projected command skill path', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      '.kiro/skills/am-command-deploy/SKILL.md',
    );
  });

  it('resolves agent path to .kiro/agents/', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.kiro/agents/my-agent.md');
  });
});

describe('kiro global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('kiro', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .kiro/steering/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.kiro/steering/AGENTS.md');
  });

  it('keeps .kiro/steering/ rule paths unchanged', () => {
    expect(rewrite('.kiro/steering/typescript.md')).toBe('.kiro/steering/typescript.md');
  });

  it('keeps .kiro/skills/ paths unchanged', () => {
    expect(rewrite('.kiro/skills/ts-pro/SKILL.md')).toBe('.kiro/skills/ts-pro/SKILL.md');
  });

  it('keeps .kiro/agents/ paths unchanged', () => {
    expect(rewrite('.kiro/agents/my-agent.md')).toBe('.kiro/agents/my-agent.md');
  });

  it('keeps .kiro/settings/mcp.json unchanged', () => {
    expect(rewrite('.kiro/settings/mcp.json')).toBe('.kiro/settings/mcp.json');
  });

  it('suppresses .kiro/hooks/ in global mode (returns null)', () => {
    expect(rewrite('.kiro/hooks/pre-tool-use.json')).toBeNull();
  });

  it('rewrites .kiroignore to .kiro/settings/kiroignore', () => {
    expect(rewrite('.kiroignore')).toBe('.kiro/settings/kiroignore');
  });
});

describe('kiro global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('kiro', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .kiro/skills/ to .agents/skills/', () => {
    expect(mirror('.kiro/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .kiro/skills/', () => {
    expect(mirror('.kiro/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for steering files (not mirrored)', () => {
    expect(mirror('.kiro/steering/typescript.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.kiro/mcp.json', [])).toBeNull();
  });
});

describe('kiro global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-kiro-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['kiro'],
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
      (r) => r.target === 'kiro' && r.path === `${KIRO_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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
      (r) => r.target === 'kiro' && r.path === `${KIRO_GLOBAL_STEERING_DIR}/ts.md`,
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('inclusion: fileMatch');
    expect(rule!.content).toContain('description: TypeScript standards');
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

    const mcpFile = results.find((r) => r.target === 'kiro' && r.path === KIRO_GLOBAL_MCP_FILE);
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
