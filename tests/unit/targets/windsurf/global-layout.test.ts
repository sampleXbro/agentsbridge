import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { WINDSURF_GLOBAL_MCP_FILE } from '../../../../src/targets/windsurf/constants.js';

describe('windsurf global layout — paths', () => {
  const layout = getTargetLayout('windsurf', 'global')!;

  it('resolves rule path to .codeium/windsurf/memories/global_rules.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.codeium/windsurf/memories/global_rules.md');
  });

  it('resolves command path to .codeium/windsurf/global_workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      '.codeium/windsurf/global_workflows/deploy.md',
    );
  });

  it('resolves agent path to .codeium/windsurf/skills/ (embedded as skill)', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
        conversions: { agents_to_skills: { windsurf: true } },
      }),
    ).toBe('.codeium/windsurf/skills/am-agent-my-agent/SKILL.md');
  });
});

describe('windsurf global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('windsurf', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .codeium/windsurf/memories/global_rules.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.codeium/windsurf/memories/global_rules.md');
  });

  it('rewrites .windsurf/workflows/ to .codeium/windsurf/global_workflows/', () => {
    expect(rewrite('.windsurf/workflows/deploy.md')).toBe(
      '.codeium/windsurf/global_workflows/deploy.md',
    );
  });

  it('rewrites .windsurf/skills/ to .codeium/windsurf/skills/', () => {
    expect(rewrite('.windsurf/skills/ts-pro/SKILL.md')).toBe(
      '.codeium/windsurf/skills/ts-pro/SKILL.md',
    );
  });

  it('suppresses .windsurf/rules/ in global mode (returns null)', () => {
    expect(rewrite('.windsurf/rules/typescript.md')).toBeNull();
  });

  it('rewrites .windsurfignore to .codeium/.codeiumignore', () => {
    expect(rewrite('.codeiumignore')).toBe('.codeium/.codeiumignore');
  });

  it('rewrites .windsurf/hooks.json to .codeium/windsurf/hooks.json', () => {
    expect(rewrite('.windsurf/hooks.json')).toBe('.codeium/windsurf/hooks.json');
  });
});

describe('windsurf global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('windsurf', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .codeium/windsurf/skills/ to .agents/skills/', () => {
    expect(mirror('.codeium/windsurf/skills/ts-pro/SKILL.md', [])).toBe(
      '.agents/skills/ts-pro/SKILL.md',
    );
  });

  it('mirrors nested supporting file under skills/', () => {
    expect(mirror('.codeium/windsurf/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.codeium/windsurf/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for global_rules.md (not mirrored)', () => {
    expect(mirror('.codeium/windsurf/memories/global_rules.md', [])).toBeNull();
  });

  it('returns null for workflow files (not mirrored)', () => {
    expect(mirror('.codeium/windsurf/global_workflows/deploy.md', [])).toBeNull();
  });
});

describe('windsurf global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-windsurf-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['windsurf'],
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
      (r) => r.target === 'windsurf' && r.path === '.codeium/windsurf/skills/debugging/SKILL.md',
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('embeds rule content in root global_rules.md in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: 'Root rule',
            globs: [],
            body: '# Root\nUse TypeScript.',
          },
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

    // Windsurf suppresses per-rule files in global mode; content embedded in root
    const rootFile = results.find(
      (r) => r.target === 'windsurf' && r.path === '.codeium/windsurf/memories/global_rules.md',
    );
    expect(rootFile).toBeDefined();
    expect(rootFile!.content).toContain('Use TypeScript.');
  });

  it('preserves MCP content in global mode (written to .codeium/windsurf/mcp_config.json with mcpServers key)', async () => {
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
      (r) => r.target === 'windsurf' && r.path === WINDSURF_GLOBAL_MCP_FILE,
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
