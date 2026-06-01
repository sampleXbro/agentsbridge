import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  ROVODEV_ROOT_FILE,
  ROVODEV_SKILLS_DIR,
  ROVODEV_MCP_FILE,
  ROVODEV_GLOBAL_DIR,
  ROVODEV_GLOBAL_ROOT_FILE,
  ROVODEV_GLOBAL_SKILLS_DIR,
  ROVODEV_GLOBAL_MCP_FILE,
} from '../../../../src/targets/rovodev/constants.js';

describe('rovodev global layout', () => {
  const descriptor = getBuiltinTargetDefinition('rovodev')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms AGENTS.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(ROVODEV_ROOT_FILE)).toBe(ROVODEV_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms .rovodev/skills/ to global skills path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${ROVODEV_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath)).toBe(`${ROVODEV_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`);
  });

  it('rewriteGeneratedPath transforms .rovodev/mcp.json to global mcp path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(ROVODEV_MCP_FILE)).toBe(ROVODEV_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath passes through unknown paths', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/other/path.md')).toBe('some/other/path.md');
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
  });

  it('globalSupport.capabilities disables unsupported features', () => {
    expect(descriptor.globalSupport!.capabilities.commands).toBe('none');
    expect(descriptor.globalSupport!.capabilities.agents).toBe('none');
    expect(descriptor.globalSupport!.capabilities.hooks).toBe('none');
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('none');
    expect(descriptor.globalSupport!.capabilities.permissions).toBe('none');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(ROVODEV_GLOBAL_DIR);
    expect(descriptor.globalSupport!.detectionPaths).toContain(ROVODEV_GLOBAL_ROOT_FILE);
    expect(descriptor.globalSupport!.detectionPaths).toContain(ROVODEV_GLOBAL_SKILLS_DIR);
  });

  it('descriptor supports conversion for commands and agents', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
  });

  it('project layout has correct rootInstructionPath', () => {
    expect(descriptor.project.rootInstructionPath).toBe(ROVODEV_ROOT_FILE);
  });

  it('project layout has correct skillDir', () => {
    expect(descriptor.project.skillDir).toBe(ROVODEV_SKILLS_DIR);
  });

  it('project layout managedOutputs includes all paths', () => {
    expect(descriptor.project.managedOutputs!.dirs).toContain(ROVODEV_SKILLS_DIR);
    expect(descriptor.project.managedOutputs!.files).toContain(ROVODEV_ROOT_FILE);
    expect(descriptor.project.managedOutputs!.files).toContain(ROVODEV_MCP_FILE);
  });

  it('global layout has correct rootInstructionPath', () => {
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(ROVODEV_GLOBAL_ROOT_FILE);
  });

  it('global layout has correct skillDir', () => {
    expect(descriptor.globalSupport!.layout.skillDir).toBe(ROVODEV_GLOBAL_SKILLS_DIR);
  });

  it('global layout managedOutputs includes all paths', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs!.dirs).toContain(
      ROVODEV_GLOBAL_SKILLS_DIR,
    );
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).toContain(
      ROVODEV_GLOBAL_ROOT_FILE,
    );
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).toContain(
      ROVODEV_GLOBAL_MCP_FILE,
    );
  });

  it('detection paths include project-level paths', () => {
    expect(descriptor.detectionPaths).toContain(ROVODEV_ROOT_FILE);
    expect(descriptor.detectionPaths).toContain(ROVODEV_SKILLS_DIR);
    expect(descriptor.detectionPaths).toContain(ROVODEV_MCP_FILE);
  });

  it('mirrorGlobalPath mirrors skills to .agents/skills/', () => {
    const mirror = descriptor.globalSupport!.layout.mirrorGlobalPath!;
    const result = mirror(`${ROVODEV_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`, ['rovodev']);
    expect(result).toBe('.agents/skills/debugging/SKILL.md');
  });

  it('mirrorGlobalPath suppresses mirror when codex-cli is active', () => {
    const mirror = descriptor.globalSupport!.layout.mirrorGlobalPath!;
    const result = mirror(`${ROVODEV_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`, [
      'rovodev',
      'codex-cli',
    ]);
    expect(result).toBeNull();
  });

  it('mirrorGlobalPath returns null for non-skill paths', () => {
    const mirror = descriptor.globalSupport!.layout.mirrorGlobalPath!;
    const result = mirror('some/other/path.md', ['rovodev']);
    expect(result).toBeNull();
  });
});

describe('rovodev global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-rovodev-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['rovodev'],
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
      (r) => r.target === 'rovodev' && r.path === `${ROVODEV_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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

    const rule = results.find((r) => r.target === 'rovodev' && r.path === ROVODEV_GLOBAL_ROOT_FILE);
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });
});
