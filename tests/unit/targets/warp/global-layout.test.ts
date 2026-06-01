import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { WARP_SKILLS_DIR, WARP_GLOBAL_SKILLS_DIR } from '../../../../src/targets/warp/constants.js';

describe('warp global layout', () => {
  const descriptor = getBuiltinTargetDefinition('warp')!;
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms .warp/skills/ to global skills path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${WARP_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath)).toBe(`${WARP_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`);
  });

  it('globalSupport.capabilities differs from project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('none');
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
    expect(descriptor.capabilities.rules).toBe('native');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(WARP_GLOBAL_SKILLS_DIR);
  });

  it('descriptor supports conversion for commands and agents', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
  });

  it('does not declare sharedArtifacts', () => {
    expect(descriptor).not.toHaveProperty('sharedArtifacts');
  });

  it('global rulePath returns null because rules capability is "none"', () => {
    // Warp's global rules are Warp Drive UI-managed; the resolver must NOT
    // fabricate a path that callers would treat as a generation target.
    const rulePath = descriptor.globalSupport!.layout.paths.rulePath('typescript', {
      source: 'rules/typescript.md',
      root: false,
      targets: [],
      description: 'ts',
      globs: [],
      body: '',
    });
    expect(rulePath).toBeNull();
  });
});

describe('warp global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-warp-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['warp'],
      features: ['skills'],
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
      (r) => r.target === 'warp' && r.path === `${WARP_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });
});
