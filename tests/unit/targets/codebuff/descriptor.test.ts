import { describe, it, expect } from 'vitest';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalRule } from '../../../../src/core/types.js';
// Enter the circular target graph from the catalog: importing the target's own
// index first leaves its BUILTIN_TARGETS slot undefined, so `getDescriptor` —
// and therefore `shouldConvertCommandsToSkills` — silently answers false.
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { descriptor } from '../../../../src/targets/codebuff/index.js';
import { descriptor as codexCli } from '../../../../src/targets/codex-cli/index.js';
import {
  CODEBUFF_ROOT_FILE,
  CODEBUFF_SKILLS_DIR,
  CODEBUFF_MCP_FILE,
  CODEBUFF_IGNORE_FILE,
  CODEBUFF_GLOBAL_ROOT_FILE,
} from '../../../../src/targets/codebuff/constants.js';

function config(overrides: Partial<ValidatedConfig> = {}): ValidatedConfig {
  return {
    version: 1,
    targets: ['codebuff'],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  };
}

function rule(overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: 'typescript.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: '',
    ...overrides,
  };
}

describe('codebuff descriptor metadata', () => {
  it('carries the published Codebuff identity', () => {
    expect(descriptor.metadata).toEqual({
      displayName: 'Codebuff',
      category: 'cli',
      officialUrl: 'https://github.com/CodebuffAI/freebuff',
      shortDescription: 'Terminal multi-agent coding CLI',
    });
  });

  it('leaves no scaffold placeholders behind', () => {
    expect(JSON.stringify(descriptor.metadata)).not.toContain('TODO');
    expect(descriptor.emptyImportMessage).not.toContain('TODO');
  });
});

describe('codebuff capabilities', () => {
  it('declares the project-scope support levels', () => {
    expect(descriptor.capabilities).toEqual({
      rules: 'native',
      additionalRules: 'native',
      commands: 'embedded',
      agents: 'partial',
      skills: 'native',
      mcp: 'native',
      hooks: 'partial',
      ignore: 'native',
      permissions: 'partial',
    });
  });

  it('declares the global-scope support levels', () => {
    expect(descriptor.globalSupport?.capabilities).toEqual({
      rules: 'native',
      additionalRules: 'embedded',
      commands: 'embedded',
      agents: 'partial',
      skills: 'native',
      mcp: 'native',
      hooks: 'partial',
      ignore: 'none',
      permissions: 'partial',
    });
  });

  it('backs every native or embedded capability with a generator', () => {
    expect(descriptor.generators.generateRules).toBeTypeOf('function');
    expect(descriptor.generators.generateCommands).toBeTypeOf('function');
    expect(descriptor.generators.generateSkills).toBeTypeOf('function');
    expect(descriptor.generators.generateMcp).toBeTypeOf('function');
    expect(descriptor.generators.generateIgnore).toBeTypeOf('function');
  });

  it('wires a lint hook for every lossy or unsupported feature', () => {
    expect(Object.keys(descriptor.lint).sort()).toEqual(['hooks', 'ignore', 'mcp', 'permissions']);
  });

  it('is reachable through the builtin catalog under its own id', () => {
    expect(getBuiltinTargetDefinition('codebuff')?.id).toBe('codebuff');
  });
});

describe('codebuff project layout', () => {
  it('nests scoped rules as <dir>/AGENTS.md', () => {
    expect(descriptor.project.paths.rulePath('typescript', rule({ globs: ['src/**/*.ts'] }))).toBe(
      'src/AGENTS.md',
    );
  });

  it('projects commands into the shared skills dir', () => {
    expect(descriptor.project.paths.commandPath('review', config())).toBe(
      `${CODEBUFF_SKILLS_DIR}/am-command-review/SKILL.md`,
    );
  });

  it('suppresses command output when the conversion is disabled', () => {
    const off = config({ conversions: { commands_to_skills: { codebuff: false } } });
    expect(descriptor.project.paths.commandPath('review', off)).toBeNull();
  });

  it('never resolves an agent path because agents are executable TypeScript', () => {
    expect(descriptor.project.paths.agentPath('code-reviewer', config())).toBeNull();
    expect(descriptor.globalSupport?.layout.paths.agentPath('code-reviewer', config())).toBeNull();
  });

  it('manages only directories and files agentsmesh fully owns', () => {
    expect(descriptor.project.managedOutputs).toEqual({
      dirs: [CODEBUFF_SKILLS_DIR],
      files: [CODEBUFF_ROOT_FILE, CODEBUFF_MCP_FILE, CODEBUFF_IGNORE_FILE],
    });
  });

  it('never manages the .agents root, which holds user agent modules', () => {
    const managed = [
      ...(descriptor.project.managedOutputs?.dirs ?? []),
      ...(descriptor.globalSupport?.layout.managedOutputs?.dirs ?? []),
    ];
    expect(managed).not.toContain('.agents');
    expect(managed).not.toContain('.agents/');
  });
});

describe('codebuff global layout', () => {
  const globalLayout = descriptor.globalSupport?.layout;

  it('redirects the root knowledge file to the home dotfile', () => {
    expect(globalLayout?.rewriteGeneratedPath?.(CODEBUFF_ROOT_FILE)).toBe(
      CODEBUFF_GLOBAL_ROOT_FILE,
    );
    expect(globalLayout?.rootInstructionPath).toBe(CODEBUFF_GLOBAL_ROOT_FILE);
  });

  it('suppresses nested knowledge files, which only exist inside a project tree', () => {
    expect(globalLayout?.rewriteGeneratedPath?.('src/AGENTS.md')).toBeNull();
  });

  it('suppresses .codebuffignore, which has no home-directory equivalent', () => {
    expect(globalLayout?.rewriteGeneratedPath?.(CODEBUFF_IGNORE_FILE)).toBeNull();
  });

  it('passes shared paths through unchanged', () => {
    expect(globalLayout?.rewriteGeneratedPath?.(CODEBUFF_MCP_FILE)).toBe(CODEBUFF_MCP_FILE);
    expect(
      globalLayout?.rewriteGeneratedPath?.(`${CODEBUFF_SKILLS_DIR}/api-generator/SKILL.md`),
    ).toBe(`${CODEBUFF_SKILLS_DIR}/api-generator/SKILL.md`);
  });

  it('embeds scoped rules into the single global knowledge file', () => {
    expect(globalLayout?.paths.rulePath('typescript', rule({ globs: ['src/**'] }))).toBe(
      CODEBUFF_GLOBAL_ROOT_FILE,
    );
    expect(globalLayout?.renderPrimaryRootInstruction).toBeTypeOf('function');
  });
});

describe('codebuff shared-artifact ownership', () => {
  it('consumes .agents/skills/ rather than claiming it from codex-cli', () => {
    expect(descriptor.sharedArtifacts).toEqual({ '.agents/skills/': 'consumer' });
    expect(codexCli.sharedArtifacts?.['.agents/skills/']).toBe('owner');
  });

  it('does not detect on paths other tools also write', () => {
    expect(descriptor.detectionPaths).not.toContain(CODEBUFF_SKILLS_DIR);
    expect(descriptor.globalSupport?.detectionPaths).not.toContain(CODEBUFF_SKILLS_DIR);
  });

  it('detects on the codebuff-specific ignore file and project knowledge file', () => {
    expect([...descriptor.detectionPaths]).toEqual([CODEBUFF_IGNORE_FILE, CODEBUFF_ROOT_FILE]);
    expect([...(descriptor.globalSupport?.detectionPaths ?? [])]).toEqual([
      CODEBUFF_GLOBAL_ROOT_FILE,
    ]);
  });
});
