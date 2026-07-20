import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  CRUSH_ROOT_FILE,
  CRUSH_SKILLS_DIR,
  CRUSH_CONFIG_FILE,
  CRUSH_IGNORE,
  CRUSH_GLOBAL_ROOT_FILE,
  CRUSH_GLOBAL_SKILLS_DIR,
  CRUSH_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/crush/constants.js';

describe('crush descriptor global layout', () => {
  const descriptor = getBuiltinTargetDefinition('crush')!;

  it('descriptor.globalSupport is defined', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('descriptor.globalSupport.layout is defined', () => {
    expect(descriptor.globalSupport!.layout).toBeDefined();
  });

  it('global layout has correct rootInstructionPath', () => {
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(CRUSH_GLOBAL_ROOT_FILE);
  });

  it('global layout has correct skillDir', () => {
    expect(descriptor.globalSupport!.layout.skillDir).toBe(CRUSH_GLOBAL_SKILLS_DIR);
  });

  it('rewriteGeneratedPath transforms AGENTS.md to global path', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(CRUSH_ROOT_FILE);
    expect(result).toBe(CRUSH_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms crush.json to global path', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(CRUSH_CONFIG_FILE);
    expect(result).toBe(CRUSH_GLOBAL_CONFIG_FILE);
  });

  it('rewriteGeneratedPath drops .crushignore in global mode', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(CRUSH_IGNORE);
    expect(result).toBeNull();
  });

  it('rewriteGeneratedPath transforms .crush/skills/ paths to global paths', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath(`${CRUSH_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(result).toBe(`${CRUSH_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('globalSupport detectionPaths includes global config', () => {
    const paths = descriptor.globalSupport!.detectionPaths;
    expect(paths).toContain(CRUSH_GLOBAL_ROOT_FILE);
    expect(paths).toContain(CRUSH_GLOBAL_CONFIG_FILE);
    expect(paths).toContain(CRUSH_GLOBAL_SKILLS_DIR);
  });

  it('rewriteGeneratedPath returns path unchanged for unknown files', () => {
    const rewriteGeneratedPath = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewriteGeneratedPath('unknown-file.txt');
    expect(result).toBe('unknown-file.txt');
  });

  it('global capabilities have correct values', () => {
    const caps = descriptor.globalSupport!.capabilities;
    expect(caps.rules).toBe('native');
    expect(caps.additionalRules).toBe('embedded');
    expect(caps.skills).toBe('native');
    expect(caps.mcp).toBe('native');
    expect(caps.hooks).toBe('native');
    expect(caps.ignore).toBe('none');
    expect(caps.permissions).toBe('native');
    expect(caps.commands).toBe('embedded');
    expect(caps.agents).toBe('none');
  });
});

describe('crush global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-crush-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['crush'],
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
      (r) => r.target === 'crush' && r.path === `${CRUSH_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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

    const rule = results.find((r) => r.target === 'crush' && r.path === CRUSH_GLOBAL_ROOT_FILE);
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });

  it('preserves MCP content in global mode (written to .config/crush/crush.json)', async () => {
    const results = await generate({
      config: {
        version: 1,
        targets: ['crush'],
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
      (r) => r.target === 'crush' && r.path === CRUSH_GLOBAL_CONFIG_FILE,
    );
    expect(mcpFile).toBeDefined();
    const parsed = JSON.parse(mcpFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcp');
    const servers = parsed.mcp as Record<string, unknown>;
    expect(servers).toHaveProperty('test-server');
    const server = servers['test-server'] as Record<string, unknown>;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@test/mcp']);
  });

  it('preserves hooks configuration in global mode', async () => {
    const results = await generate({
      config: {
        version: 1,
        targets: ['crush'],
        features: ['hooks'],
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      } as ValidatedConfig,
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

    // Crush hooks are written to crush.json, which rewrites to .config/crush/crush.json in global mode
    const hooksFile = results.find(
      (r) => r.target === 'crush' && r.path === CRUSH_GLOBAL_CONFIG_FILE,
    );
    expect(hooksFile).toBeDefined();
    const parsed = JSON.parse(hooksFile!.content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('hooks');
    const hooksObj = parsed.hooks as Record<string, unknown>;
    expect(hooksObj).toHaveProperty('PreToolUse');
    const entries = hooksObj.PreToolUse as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.matcher).toBe('Bash');
    expect(entries[0]!.command).toBe('./scripts/validate.sh');
    expect(entries[0]!.timeout).toBe(30);
  });

  it('merges mcp + hooks + permissions into a single .config/crush/crush.json in global mode', async () => {
    const results = await generate({
      config: {
        version: 1,
        targets: ['crush'],
        features: ['mcp', 'hooks', 'permissions'],
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
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              type: 'command' as const,
              command: './scripts/lint.sh',
            },
          ],
        },
        permissions: { allow: ['Read'], deny: ['WebFetch'], ask: [] },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const configs = results.filter(
      (r) => r.target === 'crush' && r.path === CRUSH_GLOBAL_CONFIG_FILE,
    );
    // All three features collapse into exactly one file
    expect(configs).toHaveLength(1);
    const parsed = JSON.parse(configs[0]!.content) as Record<string, unknown>;
    // mcp key must survive
    expect(parsed).toHaveProperty('mcp');
    // hooks key must survive
    expect(parsed).toHaveProperty('hooks');
    // permissions key must survive
    expect(parsed).toHaveProperty('permissions');
    // options (deny) must survive
    expect(parsed).toHaveProperty('options');
  });
});
