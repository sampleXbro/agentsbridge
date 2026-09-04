import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  PI_AGENT_ROOT_FILE,
  PI_AGENT_SKILLS_DIR,
  PI_AGENT_COMMANDS_DIR,
  PI_AGENT_GLOBAL_ROOT_FILE,
  PI_AGENT_GLOBAL_SKILLS_DIR,
  PI_AGENT_GLOBAL_COMMANDS_DIR,
} from '../../../../src/targets/pi-agent/constants.js';

describe('pi-agent global layout', () => {
  const descriptor = getBuiltinTargetDefinition('pi-agent')!;
  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms AGENTS.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(PI_AGENT_ROOT_FILE)).toBe(PI_AGENT_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms .pi/skills/ to global skills path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${PI_AGENT_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath)).toBe(`${PI_AGENT_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`);
  });

  it('rewriteGeneratedPath passes through unrecognized paths', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/other/path.md')).toBe('some/other/path.md');
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths).toHaveLength(1);
    expect(descriptor.globalSupport!.detectionPaths).toContain(PI_AGENT_GLOBAL_ROOT_FILE);
  });

  it('descriptor declares shared artifacts as consumer', () => {
    expect(descriptor.sharedArtifacts).toEqual({ '.agents/skills/': 'consumer' });
  });

  it('descriptor lint object has no mcp handler (mcp is none)', () => {
    expect(descriptor.lint).not.toHaveProperty('mcp');
  });

  it('descriptor projects agents only (commands are native)', () => {
    expect(descriptor.supportsConversion).toEqual({ agents: true });
  });

  it('descriptor has correct id', () => {
    expect(descriptor.id).toBe('pi-agent');
  });

  it('descriptor has correct detection paths', () => {
    expect(descriptor.detectionPaths).toEqual([PI_AGENT_ROOT_FILE, PI_AGENT_SKILLS_DIR]);
  });

  it('descriptor capabilities are correct', () => {
    expect(descriptor.capabilities).toEqual({
      rules: 'native',
      additionalRules: 'embedded',
      commands: 'native',
      agents: 'none',
      skills: 'native',
      mcp: 'none',
      hooks: 'partial',
      ignore: 'partial',
      permissions: 'native',
    });
  });

  it('project layout has managed outputs', () => {
    expect(descriptor.project.managedOutputs).toEqual({
      dirs: [PI_AGENT_SKILLS_DIR, PI_AGENT_COMMANDS_DIR],
      files: [PI_AGENT_ROOT_FILE],
    });
  });

  it('global layout has managed outputs', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs).toEqual({
      dirs: [PI_AGENT_GLOBAL_SKILLS_DIR, PI_AGENT_GLOBAL_COMMANDS_DIR],
      files: [PI_AGENT_GLOBAL_ROOT_FILE],
    });
  });

  it('project layout resolves rule paths to root file', () => {
    expect(descriptor.project.paths.rulePath('typescript')).toBe(PI_AGENT_ROOT_FILE);
  });

  it('project layout resolves command paths to native prompts dir', () => {
    expect(descriptor.project.paths.commandPath('review')).toBe(
      `${PI_AGENT_COMMANDS_DIR}/review.md`,
    );
  });

  it('project layout resolves agent paths to skills dir', () => {
    const path = descriptor.project.paths.agentPath('researcher');
    expect(path).toContain(PI_AGENT_SKILLS_DIR);
    expect(path).toContain('SKILL.md');
  });

  it('global layout resolves rule paths to global root file', () => {
    expect(descriptor.globalSupport!.layout.paths.rulePath('typescript')).toBe(
      PI_AGENT_GLOBAL_ROOT_FILE,
    );
  });

  it('global layout resolves command paths to global prompts dir', () => {
    expect(descriptor.globalSupport!.layout.paths.commandPath('review')).toBe(
      `${PI_AGENT_GLOBAL_COMMANDS_DIR}/review.md`,
    );
  });

  it('global layout resolves agent paths to global skills dir', () => {
    const path = descriptor.globalSupport!.layout.paths.agentPath('researcher');
    expect(path).toContain(PI_AGENT_GLOBAL_SKILLS_DIR);
    expect(path).toContain('SKILL.md');
  });

  it('mirrorGlobalPath mirrors skills to .agents/skills/', () => {
    const mirror = descriptor.globalSupport!.layout.mirrorGlobalPath!;
    const result = mirror(`${PI_AGENT_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`, ['pi-agent']);
    expect(result).toBe('.agents/skills/debugging/SKILL.md');
  });

  it('mirrorGlobalPath suppresses mirror when codex-cli is active', () => {
    const mirror = descriptor.globalSupport!.layout.mirrorGlobalPath!;
    const result = mirror(`${PI_AGENT_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`, [
      'pi-agent',
      'codex-cli',
    ]);
    expect(result).toBeNull();
  });

  it('mirrorGlobalPath returns null for non-skill paths', () => {
    const mirror = descriptor.globalSupport!.layout.mirrorGlobalPath!;
    const result = mirror('some/other/path.md', ['pi-agent']);
    expect(result).toBeNull();
  });
});

describe('pi-agent global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-pi-agent-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['pi-agent'],
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
      (r) =>
        r.target === 'pi-agent' && r.path === `${PI_AGENT_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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

    const rule = results.find(
      (r) => r.target === 'pi-agent' && r.path === PI_AGENT_GLOBAL_ROOT_FILE,
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
  });
});
