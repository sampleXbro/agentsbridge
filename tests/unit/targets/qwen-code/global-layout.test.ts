import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  QWEN_ROOT,
  QWEN_IGNORE,
  QWEN_SETTINGS,
  QWEN_RULES_DIR,
  QWEN_COMMANDS_DIR,
  QWEN_AGENTS_DIR,
  QWEN_SKILLS_DIR,
  QWEN_GLOBAL_ROOT,
  QWEN_GLOBAL_SETTINGS,
  QWEN_GLOBAL_COMMANDS_DIR,
  QWEN_GLOBAL_AGENTS_DIR,
  QWEN_GLOBAL_SKILLS_DIR,
} from '../../../../src/targets/qwen-code/constants.js';

describe('qwen-code global layout', () => {
  const descriptor = getBuiltinTargetDefinition('qwen-code')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms QWEN.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(QWEN_ROOT)).toBe(QWEN_GLOBAL_ROOT);
  });

  it('rewriteGeneratedPath transforms .qwen/settings.json to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(QWEN_SETTINGS)).toBe(QWEN_GLOBAL_SETTINGS);
  });

  it('rewriteGeneratedPath transforms .qwen/commands to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${QWEN_COMMANDS_DIR}/review.md`);
    expect(result).toBe(`${QWEN_GLOBAL_COMMANDS_DIR}/review.md`);
  });

  it('rewriteGeneratedPath transforms .qwen/agents to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${QWEN_AGENTS_DIR}/researcher.md`);
    expect(result).toBe(`${QWEN_GLOBAL_AGENTS_DIR}/researcher.md`);
  });

  it('rewriteGeneratedPath transforms .qwen/skills to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const result = rewrite(`${QWEN_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(result).toBe(`${QWEN_GLOBAL_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('rewriteGeneratedPath returns null for .qwenignore in global mode', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(QWEN_IGNORE)).toBeNull();
  });

  it('rewriteGeneratedPath returns null for .qwen/rules paths in global mode', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(`${QWEN_RULES_DIR}/typescript.md`)).toBeNull();
  });

  it('rewriteGeneratedPath passes through unknown paths unchanged', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/unknown/path.txt')).toBe('some/unknown/path.txt');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(QWEN_GLOBAL_ROOT);
  });
});

describe('qwen-code global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-qwen-code-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['qwen-code'],
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
      (r) => r.target === 'qwen-code' && r.path === `${QWEN_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('preserves root rule content in global mode', async () => {
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
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rootFile = results.find((r) => r.target === 'qwen-code' && r.path === QWEN_GLOBAL_ROOT);
    expect(rootFile).toBeDefined();
    expect(rootFile!.content).toContain('# Root');
    expect(rootFile!.content).toContain('Use TypeScript.');
  });

  it('suppresses non-root rule files in global mode', async () => {
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

    const ruleFile = results.find(
      (r) => r.target === 'qwen-code' && r.path.includes('rules/ts.md'),
    );
    expect(ruleFile).toBeUndefined();
  });
});
