import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generateContinueGlobalConfig } from '../../../../src/targets/continue/global-config.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { CONTINUE_SKILLS_DIR } from '../../../../src/targets/continue/constants.js';

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

describe('continue global layout — paths', () => {
  const layout = getTargetLayout('continue', 'global')!;

  it('resolves rule path to .continue/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.continue/rules/typescript.md');
  });

  it('resolves command path to .continue/prompts/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.continue/prompts/deploy.md');
  });

  it('returns projected agent skill path', () => {
    expect(layout.paths.agentPath('my-agent', {} as never)).toBe(
      '.continue/skills/am-agent-my-agent/SKILL.md',
    );
  });
});

describe('continue global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('continue', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .continue/skills/ to .agents/skills/', () => {
    expect(mirror('.continue/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .continue/skills/', () => {
    expect(mirror('.continue/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for rule files (not mirrored)', () => {
    expect(mirror('.continue/rules/typescript.md', [])).toBeNull();
  });

  it('returns null for prompt files (not mirrored)', () => {
    expect(mirror('.continue/prompts/commit.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.continue/mcpServers/agentsmesh.json', [])).toBeNull();
  });
});

describe('continue global layout — no rewriteGeneratedPath', () => {
  const layout = getTargetLayout('continue', 'global')!;

  it('has no rewriteGeneratedPath (paths are identity in global mode)', () => {
    expect(layout.rewriteGeneratedPath).toBeUndefined();
  });
});

describe('generateContinueGlobalConfig', () => {
  const fakeRoot = join(tmpdir(), 'am-continue-config-test');
  const features = new Set(['rules', 'commands', 'mcp']);

  it('returns empty when scope is project', async () => {
    const canonical = makeCanonical({
      rules: [
        { source: 'r', root: true, targets: [], description: 'R', globs: [], body: 'content' },
      ],
    });
    const result = await generateContinueGlobalConfig(canonical, fakeRoot, 'project', features);
    expect(result).toEqual([]);
  });

  it('returns empty when no data enabled', async () => {
    const result = await generateContinueGlobalConfig(
      makeCanonical(),
      fakeRoot,
      'global',
      features,
    );
    expect(result).toEqual([]);
  });

  it('emits .continue/config.yaml with rules block', async () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/rules/ts.md',
          root: false,
          targets: [],
          description: 'TS rules',
          globs: [],
          body: 'Use strict mode.',
        },
      ],
    });
    const result = await generateContinueGlobalConfig(canonical, fakeRoot, 'global', features);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('.continue/config.yaml');
    const parsed = yamlParse(result[0].content) as Record<string, unknown>;
    expect(parsed.name).toBe('agentsmesh');
    expect(Array.isArray(parsed.rules)).toBe(true);
    const rules = parsed.rules as Array<{ name: string; rule: string }>;
    expect(rules[0].name).toBe('TS rules');
    expect(rules[0].rule).toBe('Use strict mode.');
  });

  it('emits prompts block from commands', async () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/p/commands/review.md',
          name: 'review',
          description: 'Review code',
          allowedTools: [],
          body: 'Review it.',
        },
      ],
    });
    const result = await generateContinueGlobalConfig(canonical, fakeRoot, 'global', features);
    expect(result).toHaveLength(1);
    const parsed = yamlParse(result[0].content) as Record<string, unknown>;
    expect(Array.isArray(parsed.prompts)).toBe(true);
    const prompts = parsed.prompts as Array<{ name: string; description: string; prompt: string }>;
    expect(prompts[0].name).toBe('review');
    expect(prompts[0].description).toBe('Review code');
    expect(prompts[0].prompt).toBe('Review it.');
  });

  it('emits mcpServers block from mcp config', async () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: { 'my-server': { type: 'stdio', command: 'node', args: ['s.js'], env: {} } },
      },
    });
    const result = await generateContinueGlobalConfig(canonical, fakeRoot, 'global', features);
    expect(result).toHaveLength(1);
    const parsed = yamlParse(result[0].content) as Record<string, unknown>;
    expect(Array.isArray(parsed.mcpServers)).toBe(true);
  });
});

describe('continue global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-continue-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['continue'],
      features: ['rules', 'skills'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    } as ValidatedConfig;
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
      (r) => r.target === 'continue' && r.path === `${CONTINUE_SKILLS_DIR}/debugging/SKILL.md`,
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
            source: '/proj/.agentsmesh/rules/ts.md',
            root: false,
            targets: [],
            description: 'TypeScript standards',
            globs: [],
            body: 'Use TDD and strict TypeScript.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rule = results.find((r) => r.target === 'continue' && r.path === '.continue/rules/ts.md');
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });

  it('preserves MCP content in global mode (written to .continue/mcpServers/agentsmesh.json)', async () => {
    const results = await generate({
      config: {
        version: 1,
        targets: ['continue'],
        features: ['mcp'],
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      } as ValidatedConfig,
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
      (r) => r.target === 'continue' && r.path === '.continue/mcpServers/agentsmesh.json',
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
