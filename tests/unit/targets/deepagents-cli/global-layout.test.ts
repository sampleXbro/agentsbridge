import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
  DEEPAGENTS_CLI_HOOKS_FILE,
  DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
  DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
  DEEPAGENTS_CLI_GLOBAL_MCP_FILE,
  DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
} from '../../../../src/targets/deepagents-cli/constants.js';

describe('deepagents-cli global layout', () => {
  const descriptor = getBuiltinTargetDefinition('deepagents-cli')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms project root file to global root file', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(DEEPAGENTS_CLI_ROOT_FILE)).toBe(DEEPAGENTS_CLI_GLOBAL_ROOT_FILE);
  });

  it('rewriteGeneratedPath transforms project skills to global skills', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${DEEPAGENTS_CLI_SKILLS_DIR}/debugging/SKILL.md`;
    const expected = `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath)).toBe(expected);
  });

  it('rewriteGeneratedPath transforms project MCP to global MCP', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(DEEPAGENTS_CLI_MCP_FILE)).toBe(DEEPAGENTS_CLI_GLOBAL_MCP_FILE);
  });

  it('rewriteGeneratedPath passes through unknown paths', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/other/path.md')).toBe('some/other/path.md');
  });

  it('project capabilities.hooks is native', () => {
    expect(descriptor.capabilities.hooks).toBe('native');
  });

  it('globalSupport.capabilities matches project capabilities for supported features', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport!.capabilities.skills).toBe('native');
    expect(descriptor.globalSupport!.capabilities.mcp).toBe('native');
  });

  it('globalSupport.capabilities.hooks is native', () => {
    expect(descriptor.globalSupport!.capabilities.hooks).toBe('native');
  });

  it('globalSupport.capabilities disables unsupported features', () => {
    expect(descriptor.globalSupport!.capabilities.commands).toBe('none');
    expect(descriptor.globalSupport!.capabilities.agents).toBe('none');
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('none');
    expect(descriptor.globalSupport!.capabilities.permissions).toBe('none');
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(DEEPAGENTS_CLI_GLOBAL_ROOT_FILE);
    expect(descriptor.globalSupport!.detectionPaths).toContain(DEEPAGENTS_CLI_GLOBAL_MCP_FILE);
  });

  it('descriptor supports conversion for commands and agents', () => {
    expect(descriptor.supportsConversion).toEqual({ commands: true, agents: true });
  });

  it('project layout has correct rootInstructionPath', () => {
    expect(descriptor.project.rootInstructionPath).toBe(DEEPAGENTS_CLI_ROOT_FILE);
  });

  it('project layout has correct skillDir', () => {
    expect(descriptor.project.skillDir).toBe(DEEPAGENTS_CLI_SKILLS_DIR);
  });

  it('project layout managedOutputs includes all paths', () => {
    expect(descriptor.project.managedOutputs!.dirs).toContain(DEEPAGENTS_CLI_SKILLS_DIR);
    expect(descriptor.project.managedOutputs!.files).toContain(DEEPAGENTS_CLI_ROOT_FILE);
    expect(descriptor.project.managedOutputs!.files).toContain(DEEPAGENTS_CLI_MCP_FILE);
    expect(descriptor.project.managedOutputs!.files).toContain(DEEPAGENTS_CLI_HOOKS_FILE);
  });

  it('globalLayout managedOutputs includes global hooks file', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).toContain(
      DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
    );
  });

  it('detection paths include project-level paths', () => {
    expect(descriptor.detectionPaths).toContain(DEEPAGENTS_CLI_ROOT_FILE);
    expect(descriptor.detectionPaths).toContain(DEEPAGENTS_CLI_MCP_FILE);
  });
});

describe('deepagents-cli global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-deepagents-cli-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['deepagents-cli'],
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
        r.target === 'deepagents-cli' &&
        r.path === `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
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
      (r) => r.target === 'deepagents-cli' && r.path === DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
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
      (r) => r.target === 'deepagents-cli' && r.path === DEEPAGENTS_CLI_GLOBAL_MCP_FILE,
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
