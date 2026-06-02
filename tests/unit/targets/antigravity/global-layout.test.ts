import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_MCP_CONFIG,
} from '../../../../src/targets/antigravity/constants.js';

describe('antigravity global layout — paths', () => {
  const layout = getTargetLayout('antigravity', 'global')!;

  it('resolves rule path to .gemini/antigravity/GEMINI.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.gemini/antigravity/GEMINI.md');
  });

  it('resolves command path to .gemini/antigravity/workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      '.gemini/antigravity/workflows/deploy.md',
    );
  });

  it('returns projected agent skill path under .gemini/antigravity/skills/', () => {
    // Phase 7.F: agentPath must return the global path directly so reference
    // map consumers (`agentTargetPath`) get the correct destination without
    // depending on `rewriteGeneratedPath` running after them.
    expect(layout.paths.agentPath('reviewer', {} as never)).toBe(
      '.gemini/antigravity/skills/am-agent-reviewer/SKILL.md',
    );
  });
});

describe('antigravity global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('antigravity', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .agents/rules/general.md to .gemini/antigravity/GEMINI.md', () => {
    expect(rewrite('.agents/rules/general.md')).toBe('.gemini/antigravity/GEMINI.md');
  });

  it('suppresses per-rule files (returns null)', () => {
    expect(rewrite('.agents/rules/typescript.md')).toBeNull();
    expect(rewrite('.agents/rules/testing.md')).toBeNull();
  });

  it('rewrites .agents/skills/ to .gemini/antigravity/skills/', () => {
    expect(rewrite('.agents/skills/ts-pro/SKILL.md')).toBe(
      '.gemini/antigravity/skills/ts-pro/SKILL.md',
    );
  });

  it('rewrites .agents/workflows/ to .gemini/antigravity/workflows/', () => {
    expect(rewrite('.agents/workflows/deploy.md')).toBe('.gemini/antigravity/workflows/deploy.md');
  });

  it('rewrites .agents/antigravity/mcp_config.json to .gemini/antigravity/mcp_config.json', () => {
    expect(rewrite('.agents/antigravity/mcp_config.json')).toBe(
      '.gemini/antigravity/mcp_config.json',
    );
  });

  it('returns unchanged path for unrecognized paths', () => {
    expect(rewrite('.gemini/antigravity/other/file.md')).toBe('.gemini/antigravity/other/file.md');
  });
});

describe('antigravity global layout — no mirrorGlobalPath', () => {
  const layout = getTargetLayout('antigravity', 'global')!;

  it('has no mirrorGlobalPath (antigravity uses .gemini/antigravity/ namespace)', () => {
    expect(layout.mirrorGlobalPath).toBeUndefined();
  });
});

describe('antigravity global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-antigravity-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['antigravity'],
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

  it('preserves embedded skill frontmatter in global mode', async () => {
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
      (r) =>
        r.target === 'antigravity' &&
        r.path === `${ANTIGRAVITY_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('preserves rule body content in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Use TDD and strict TypeScript.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rule = results.find(
      (r) => r.target === 'antigravity' && r.path === ANTIGRAVITY_GLOBAL_ROOT,
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });

  it('preserves MCP content in global mode (written to .gemini/antigravity/mcp_config.json)', async () => {
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
      (r) => r.target === 'antigravity' && r.path === ANTIGRAVITY_GLOBAL_MCP_CONFIG,
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
