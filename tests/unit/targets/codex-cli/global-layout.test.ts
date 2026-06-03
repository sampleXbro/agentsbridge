import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

describe('codex-cli global layout — paths', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;

  it('resolves rule path to .codex/AGENTS.md (aggregate for advisory rules)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.codex/AGENTS.md');
  });

  it('resolves command path to .agents/skills/ (embedded as skill)', () => {
    expect(
      layout.paths.commandPath('deploy', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
        conversions: { commands_to_skills: { 'codex-cli': true } },
      }),
    ).toBe('.agents/skills/am-command-deploy/SKILL.md');
  });

  it('resolves agent path to .codex/agents/', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.codex/agents/my-agent.toml');
  });
});

describe('codex-cli global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .codex/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.codex/AGENTS.md');
  });

  it('keeps .agents/skills/ paths unchanged', () => {
    expect(rewrite('.agents/skills/ts-pro/SKILL.md')).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('keeps .codex/agents/ paths unchanged', () => {
    expect(rewrite('.codex/agents/my-agent.toml')).toBe('.codex/agents/my-agent.toml');
  });

  it('suppresses .codex/instructions/ in global mode (returns null)', () => {
    expect(rewrite('.codex/instructions/typescript.md')).toBeNull();
  });

  it('keeps .codex/config.toml unchanged', () => {
    expect(rewrite('.codex/config.toml')).toBe('.codex/config.toml');
  });
});

describe('codex-cli global layout — no mirrorGlobalPath', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;

  it('has no mirrorGlobalPath (skills already in .agents/)', () => {
    expect(layout.mirrorGlobalPath).toBeUndefined();
  });
});

describe('codex-cli global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-codex-cli-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['codex-cli'],
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
      (r) => r.target === 'codex-cli' && r.path === '.agents/skills/debugging/SKILL.md',
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('embeds rule content in root AGENTS.md in global mode', async () => {
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

    // Codex-CLI embeds non-root advisory rules into .codex/AGENTS.md in global mode
    const rootFile = results.find((r) => r.target === 'codex-cli' && r.path === '.codex/AGENTS.md');
    expect(rootFile).toBeDefined();
    expect(rootFile!.content).toContain('TypeScript standards');
    expect(rootFile!.content).toContain('Use strict mode.');
  });

  it('preserves MCP content in global mode (written to .codex/config.toml)', async () => {
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
      (r) => r.target === 'codex-cli' && r.path === '.codex/config.toml',
    );
    expect(mcpFile).toBeDefined();
    const parsed = parseToml(mcpFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcp_servers');
    const servers = parsed.mcp_servers as Record<string, unknown>;
    expect(servers).toHaveProperty('test-server');
    const server = servers['test-server'] as Record<string, unknown>;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@test/mcp']);
  });
});
