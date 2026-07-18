import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  ROO_CODE_GLOBAL_MCP_FILE,
  ROO_CODE_GLOBAL_MODES_FILE,
} from '../../../../src/targets/roo-code/constants.js';
import { descriptor } from '../../../../src/targets/roo-code/index.js';
import { generateRooGlobalExtras } from '../../../../src/targets/roo-code/layout.js';

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

  it('keeps .roo/rules/00-root.md unchanged (no AGENTS.md redirect)', () => {
    // Roo Code's loadRuleFiles() reads `.roo/rules/` from BOTH the global
    // `~/.roo` dir and the project dir; loadAllAgentRulesFiles() never checks
    // the home directory for AGENTS.md. The root rule stays in .roo/rules/.
    expect(rewrite('.roo/rules/00-root.md')).toBe('.roo/rules/00-root.md');
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

  it('suppresses .roomodes in global mode (returns null)', () => {
    expect(rewrite('.roomodes')).toBeNull();
  });

  it('returns unrelated paths unchanged (fallback branch, e.g. .rooignore)', () => {
    // .rooignore is never actually generated in global scope (generateIgnore
    // short-circuits first), but rewriteGeneratedPath must still fall through
    // its final `return path` for any path matching none of the special cases.
    expect(rewrite('.rooignore')).toBe('.rooignore');
  });
});

describe('roo-code global layout — rootInstructionPath', () => {
  it('points at .roo/rules/00-root.md, not .roo/AGENTS.md', () => {
    const layout = getTargetLayout('roo-code', 'global')!;
    expect(layout.rootInstructionPath).toBe('.roo/rules/00-root.md');
  });
});

describe('roo-code descriptor — capability levels', () => {
  it('raises project permissions to native and keeps global permissions partial', () => {
    expect(descriptor.capabilities.permissions).toBe('native');
    expect(descriptor.globalSupport?.capabilities.permissions).toBe('partial');
  });

  it('downgrades global mcp to partial (real path is non-deterministic globalStorage)', () => {
    expect(descriptor.capabilities.mcp).toBe('native');
    expect(descriptor.globalSupport?.capabilities.mcp).toBe('partial');
  });

  it('downgrades global ignore to none (RooIgnoreController has no global/home-dir concept)', () => {
    expect(descriptor.capabilities.ignore).toBe('native');
    expect(descriptor.globalSupport?.capabilities.ignore).toBe('none');
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

  it('writes the root rule to .roo/rules/00-root.md, never .roo/AGENTS.md', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['rules'] } as ValidatedConfig,
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Root instructions.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const root = results.find((r) => r.target === 'roo-code' && r.path === '.roo/rules/00-root.md');
    expect(root).toBeDefined();
    expect(root!.content).toContain('Root instructions.');
    expect(results.some((r) => r.target === 'roo-code' && r.path === '.roo/AGENTS.md')).toBe(false);
  });

  it('emits agents at .roo/settings/custom_modes.yaml with a groups field', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['agents'] } as ValidatedConfig,
      canonical: makeCanonical({
        agents: [
          {
            source: '/proj/.agentsmesh/agents/coder.md',
            name: 'Coder',
            description: 'Writes code',
            body: 'Write clean code.',
            tools: [],
            allowedTools: [],
            disallowedTools: [],
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const modesFile = results.find(
      (r) => r.target === 'roo-code' && r.path === '.roo/settings/custom_modes.yaml',
    );
    expect(modesFile).toBeDefined();
    expect(modesFile!.content).toContain('groups:');
    expect(results.some((r) => r.target === 'roo-code' && r.path === '.roomodes')).toBe(false);
  });

  it('emits nothing for ignore or permissions in global scope', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['ignore', 'permissions'] } as ValidatedConfig,
      canonical: makeCanonical({
        ignore: ['.env'],
        permissions: { allow: ['Read'], deny: [] },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    expect(results.some((r) => r.target === 'roo-code' && r.path === '.rooignore')).toBe(false);
    expect(results.some((r) => r.target === 'roo-code' && r.path === '.vscode/settings.json')).toBe(
      false,
    );
  });
});

describe('generateRooGlobalExtras — computeStatus branches', () => {
  const TEST_DIR = join(tmpdir(), 'am-roo-code-global-extras');
  const modesFilePath = join(TEST_DIR, ROO_CODE_GLOBAL_MODES_FILE);

  beforeEach(() => mkdirSync(dirname(modesFilePath), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  function makeCanonicalWithAgent(): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [
        {
          source: '/proj/.agentsmesh/agents/coder.md',
          name: 'Coder',
          description: 'Writes code',
          body: 'Write clean code.',
          tools: [],
          allowedTools: [],
          disallowedTools: [],
        },
      ],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    } as unknown as CanonicalFiles;
  }

  it('reports status "updated" when custom_modes.yaml exists with different content', async () => {
    writeFileSync(modesFilePath, 'customModes: []\n');

    const results = await generateRooGlobalExtras(
      makeCanonicalWithAgent(),
      TEST_DIR,
      'global',
      new Set(['agents']),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('updated');
    expect(results[0]!.currentContent).toBe('customModes: []\n');
  });

  it('reports status "unchanged" when custom_modes.yaml already matches generated content', async () => {
    const first = await generateRooGlobalExtras(
      makeCanonicalWithAgent(),
      TEST_DIR,
      'global',
      new Set(['agents']),
    );
    writeFileSync(modesFilePath, first[0]!.content);

    const second = await generateRooGlobalExtras(
      makeCanonicalWithAgent(),
      TEST_DIR,
      'global',
      new Set(['agents']),
    );

    expect(second).toHaveLength(1);
    expect(second[0]!.status).toBe('unchanged');
    expect(second[0]!.content).toBe(first[0]!.content);
  });
});
