import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

describe('cline global layout — paths', () => {
  const layout = getTargetLayout('cline', 'global')!;

  it('resolves rule path to Documents/Cline/Rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('Documents/Cline/Rules/typescript.md');
  });

  it('resolves command path to Documents/Cline/Workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      'Documents/Cline/Workflows/deploy.md',
    );
  });

  it('resolves agent path to .cline/skills/ (embedded as skill)', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
        conversions: { agents_to_skills: { cline: true } },
      }),
    ).toBe('.cline/skills/am-agent-my-agent/SKILL.md');
  });
});

describe('cline global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('suppresses AGENTS.md in global mode (returns null)', () => {
    expect(rewrite('AGENTS.md')).toBeNull();
  });

  it('rewrites .clinerules/workflows/ to Documents/Cline/Workflows/', () => {
    expect(rewrite('.clinerules/workflows/deploy.md')).toBe('Documents/Cline/Workflows/deploy.md');
  });

  it('rewrites .clinerules/ rules to Documents/Cline/Rules/', () => {
    expect(rewrite('.clinerules/typescript.md')).toBe('Documents/Cline/Rules/typescript.md');
  });

  it('keeps .cline/skills/ paths unchanged', () => {
    expect(rewrite('.cline/skills/ts-pro/SKILL.md')).toBe('.cline/skills/ts-pro/SKILL.md');
  });

  it('keeps .cline/cline_mcp_settings.json unchanged', () => {
    expect(rewrite('.cline/cline_mcp_settings.json')).toBe('.cline/cline_mcp_settings.json');
  });

  it('keeps .clineignore unchanged', () => {
    expect(rewrite('.clineignore')).toBe('.clineignore');
  });
});

describe('cline global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .cline/skills/ to .agents/skills/', () => {
    expect(mirror('.cline/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .cline/skills/', () => {
    expect(mirror('.cline/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('AGENTS.md', [])).toBeNull();
  });

  it('returns null for workflow files (not mirrored)', () => {
    expect(mirror('Documents/Cline/Workflows/commit.md', [])).toBeNull();
  });
});

describe('cline global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-cline-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['cline'],
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
      (r) => r.target === 'cline' && r.path === '.cline/skills/debugging/SKILL.md',
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
      (r) => r.target === 'cline' && r.path === 'Documents/Cline/Rules/ts.md',
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('description: TypeScript standards');
    expect(rule!.content).toContain('src/**/*.ts');
    expect(rule!.content).toContain('Use strict mode.');
  });

  it('preserves MCP content in global mode (written to .cline/cline_mcp_settings.json)', async () => {
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
      (r) => r.target === 'cline' && r.path === '.cline/cline_mcp_settings.json',
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
