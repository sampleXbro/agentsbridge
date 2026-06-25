import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  AUGMENT_CODE_RULES_DIR,
  AUGMENT_CODE_COMMANDS_DIR,
  AUGMENT_CODE_SKILLS_DIR,
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_IGNORE_FILE,
  AUGMENT_CODE_GLOBAL_RULES_DIR,
  AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
  AUGMENT_CODE_GLOBAL_SKILLS_DIR,
  AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/augment-code/constants.js';

describe('augment-code global layout', () => {
  const descriptor = getBuiltinTargetDefinition('augment-code')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites rules dir', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${AUGMENT_CODE_RULES_DIR}/typescript.md`);
    expect(result).toBe(`${AUGMENT_CODE_GLOBAL_RULES_DIR}/typescript.md`);
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites commands dir', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${AUGMENT_CODE_COMMANDS_DIR}/review.md`);
    expect(result).toBe(`${AUGMENT_CODE_GLOBAL_COMMANDS_DIR}/review.md`);
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites skills dir', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${AUGMENT_CODE_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(result).toBe(`${AUGMENT_CODE_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('globalSupport.layout.rewriteGeneratedPath rewrites settings.json', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(AUGMENT_CODE_SETTINGS_FILE);
    expect(result).toBe(AUGMENT_CODE_GLOBAL_SETTINGS_FILE);
  });

  it('globalSupport.layout.rewriteGeneratedPath returns null for .augmentignore', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(AUGMENT_CODE_IGNORE_FILE);
    expect(result).toBeNull();
  });

  it('globalSupport.capabilities has hooks: none', () => {
    expect(descriptor.globalSupport!.capabilities.hooks).toBe('none');
  });

  it('globalSupport.capabilities has ignore: none', () => {
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('none');
  });

  it('globalSupport.capabilities has rules: native', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
  });

  it('globalSupport.capabilities has skills: native', () => {
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
  });

  it('globalSupport.capabilities has mcp: native', () => {
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
  });

  it('globalSupport.layout.rewriteGeneratedPath passes through unknown paths unchanged', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite('some/other/path.txt');
    expect(result).toBe('some/other/path.txt');
  });

  it('globalSupport.detectionPaths includes global dirs', () => {
    const paths = descriptor.globalSupport!.detectionPaths;
    expect(paths).toContain(AUGMENT_CODE_GLOBAL_RULES_DIR);
    expect(paths).toContain(AUGMENT_CODE_GLOBAL_SKILLS_DIR);
    expect(paths).toContain(AUGMENT_CODE_GLOBAL_SETTINGS_FILE);
  });
});

describe('augment-code global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-augment-code-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['augment-code'],
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
      (r) =>
        r.target === 'augment-code' &&
        r.path === `${AUGMENT_CODE_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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
      (r) => r.target === 'augment-code' && r.path === `${AUGMENT_CODE_GLOBAL_RULES_DIR}/ts.md`,
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('description: TypeScript standards');
    expect(rule!.content).toContain('type: agent_requested');
    expect(rule!.content).toContain('src/**/*.ts');
    expect(rule!.content).toContain('Use strict mode.');
  });

  it('preserves MCP content in global mode (written to .augment/settings.json with mcpServers key)', async () => {
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
      (r) => r.target === 'augment-code' && r.path === AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
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
