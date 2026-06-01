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
    expect(caps.skills).toBe('native');
    expect(caps.mcp).toBe('native');
    expect(caps.hooks).toBe('native');
    expect(caps.ignore).toBe('none');
    expect(caps.permissions).toBe('none');
    expect(caps.commands).toBe('none');
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
});
