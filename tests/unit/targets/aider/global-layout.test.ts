import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  AIDER_CONVENTIONS,
  AIDER_IGNORE,
  AIDER_GLOBAL_CONVENTIONS,
  AIDER_GLOBAL_IGNORE,
  AIDER_SKILLS_DIR,
  AIDER_GLOBAL_SKILLS_DIR,
} from '../../../../src/targets/aider/constants.js';

describe('aider global layout', () => {
  const descriptor = getBuiltinTargetDefinition('aider')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms CONVENTIONS.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_CONVENTIONS, '')).toBe(AIDER_GLOBAL_CONVENTIONS);
  });

  it('rewriteGeneratedPath transforms .aiderignore to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_IGNORE, '')).toBe(AIDER_GLOBAL_IGNORE);
  });

  it('rewriteGeneratedPath transforms .aider/skills/ to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${AIDER_SKILLS_DIR}/debugging/SKILL.md`;
    const expectedPath = `${AIDER_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath, '')).toBe(expectedPath);
  });

  it('rewriteGeneratedPath passes through unknown paths unchanged', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/unknown/path.txt', '')).toBe('some/unknown/path.txt');
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(AIDER_GLOBAL_CONVENTIONS);
  });
});

describe('aider global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-aider-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['aider'],
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
      (r) => r.target === 'aider' && r.path === `${AIDER_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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

    const rule = results.find((r) => r.target === 'aider' && r.path === AIDER_GLOBAL_CONVENTIONS);
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });
});
