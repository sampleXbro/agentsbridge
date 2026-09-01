import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_AGENTS_DIR,
  TRAE_COMMANDS_DIR,
  TRAE_SKILLS_DIR,
  TRAE_MCP_FILE,
  TRAE_IGNORE,
  TRAE_HOOKS_FILE,
  TRAE_GLOBAL_ROOT_RULE,
  TRAE_GLOBAL_RULES_DIR,
  TRAE_GLOBAL_AGENTS_DIR,
  TRAE_GLOBAL_COMMANDS_DIR,
  TRAE_GLOBAL_SKILLS_DIR,
  TRAE_GLOBAL_MCP_FILE,
  TRAE_GLOBAL_HOOKS_FILE,
  TRAE_GLOBAL_PERMISSIONS_FILE,
} from '../../../../src/targets/trae/constants.js';

describe('trae descriptor global layout', () => {
  const descriptor = getBuiltinTargetDefinition('trae')!;
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites project_rules.md to global root', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_PROJECT_RULES)).toBe(TRAE_GLOBAL_ROOT_RULE);
  });

  it('rewriteGeneratedPath rewrites .trae/rules/*.md to .trae/user_rules/*.md', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${TRAE_RULES_DIR}/typescript.md`)).toBe(
      `${TRAE_GLOBAL_RULES_DIR}/typescript.md`,
    );
  });

  it('rewriteGeneratedPath rewrites .trae/skills/ to .trae/skills/ (same path)', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${TRAE_SKILLS_DIR}/api-generator/SKILL.md`)).toBe(
      `${TRAE_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`,
    );
  });

  it('rewriteGeneratedPath rewrites mcp.json to global mcp.json', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_MCP_FILE)).toBe(TRAE_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath suppresses project-level ignore file in global mode', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_IGNORE)).toBeNull();
  });

  it('rewriteGeneratedPath rewrites .trae/agents/<name>.md to .trae-cn/agents/<name>.md', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${TRAE_AGENTS_DIR}/code-reviewer.md`)).toBe(
      `${TRAE_GLOBAL_AGENTS_DIR}/code-reviewer.md`,
    );
  });

  it('rewriteGeneratedPath rewrites .trae/commands/<name>.md to .trae/commands/<name>.md (global)', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${TRAE_COMMANDS_DIR}/review.md`)).toBe(`${TRAE_GLOBAL_COMMANDS_DIR}/review.md`);
  });

  it('rewriteGeneratedPath rewrites .trae/hooks.json to .trae-cn/hooks.json', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(TRAE_HOOKS_FILE)).toBe(TRAE_GLOBAL_HOOKS_FILE);
  });

  it('globalSupport.capabilities has native agents and hooks, partial permissions', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.agents).toBe('native');
    expect(caps.hooks).toBe('native');
    // Additive-only writes into a file Trae maintains itself, and an
    // undocumented per-rule shape inside commandRules — see index.ts.
    expect(caps.permissions).toBe('partial');
  });

  it('keeps permissions unsupported in project scope', () => {
    expect(descriptor.capabilities.permissions).toBe('none');
  });

  it('does not manage the global permission file for stale cleanup', () => {
    const managed = descriptor.globalSupport!.layout.managedOutputs!;
    expect(managed.files).not.toContain(TRAE_GLOBAL_PERMISSIONS_FILE);
    expect(managed.dirs.some((dir) => TRAE_GLOBAL_PERMISSIONS_FILE.startsWith(`${dir}/`))).toBe(
      false,
    );
  });

  it('emits ~/.trae/permission/global.json only in global scope', async () => {
    const config = {
      version: 1,
      targets: ['trae'],
      features: ['permissions'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    } as ValidatedConfig;
    const canonical: CanonicalFiles = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: { allow: ['Bash(npm run test:*)'], deny: [], ask: [] },
      hooks: null,
      ignore: [],
    };
    const projectRoot = join(tmpdir(), 'am-trae-global-perms');

    const globalResults = await generate({ config, canonical, projectRoot, scope: 'global' });
    const projectResults = await generate({ config, canonical, projectRoot, scope: 'project' });

    expect(globalResults.find((r) => r.path === TRAE_GLOBAL_PERMISSIONS_FILE)?.content).toContain(
      '"npm run test"',
    );
    expect(projectResults.find((r) => r.path === TRAE_GLOBAL_PERMISSIONS_FILE)).toBeUndefined();
  });

  it('globalSupport.capabilities has native commands', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.commands).toBe('native');
  });

  it('globalSupport.capabilities has native rules, additionalRules, skills, mcp', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.rules).toBe('native');
    expect(caps.additionalRules).toBe('native');
    expect(caps.skills).toBe('native');
    expect(caps.mcp).toBe('native');
  });

  it('global layout has correct rootInstructionPath', () => {
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(TRAE_GLOBAL_ROOT_RULE);
  });
});

describe('trae global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-trae-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['trae'],
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
      (r) => r.target === 'trae' && r.path === `${TRAE_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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

    const rule = results.find((r) => r.target === 'trae' && r.path === TRAE_GLOBAL_ROOT_RULE);
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });

  it('preserves MCP content in global mode (written to .trae/mcp.json with mcpServers key)', async () => {
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

    const mcpFile = results.find((r) => r.target === 'trae' && r.path === TRAE_GLOBAL_MCP_FILE);
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
