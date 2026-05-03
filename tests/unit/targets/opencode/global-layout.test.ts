import { describe, it, expect } from 'vitest';
import {
  getBuiltinTargetDefinition,
  getTargetCapabilities,
  getTargetLayout,
} from '../../../../src/targets/catalog/builtin-targets.js';
import {
  OPENCODE_ROOT_RULE,
  OPENCODE_CONFIG_FILE,
  OPENCODE_GLOBAL_AGENTS_MD,
  OPENCODE_GLOBAL_RULES_DIR,
  OPENCODE_GLOBAL_COMMANDS_DIR,
  OPENCODE_GLOBAL_AGENTS_DIR,
  OPENCODE_GLOBAL_SKILLS_DIR,
  OPENCODE_GLOBAL_CONFIG_FILE,
} from '../../../../src/targets/opencode/constants.js';

describe('opencode global layout — paths', () => {
  const layout = getTargetLayout('opencode', 'global')!;

  it('resolves rule path to .config/opencode/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe(`${OPENCODE_GLOBAL_RULES_DIR}/typescript.md`);
  });

  it('resolves command path to .config/opencode/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      `${OPENCODE_GLOBAL_COMMANDS_DIR}/deploy.md`,
    );
  });

  it('resolves agent path to .config/opencode/agents/', () => {
    expect(layout.paths.agentPath('reviewer', {} as never)).toBe(
      `${OPENCODE_GLOBAL_AGENTS_DIR}/reviewer.md`,
    );
  });

  it('declares all global managed-output dirs', () => {
    expect(layout.managedOutputs.dirs).toEqual([
      OPENCODE_GLOBAL_RULES_DIR,
      OPENCODE_GLOBAL_COMMANDS_DIR,
      OPENCODE_GLOBAL_AGENTS_DIR,
      OPENCODE_GLOBAL_SKILLS_DIR,
      '.agents/skills',
    ]);
  });

  it('declares all global managed-output files', () => {
    expect(layout.managedOutputs.files).toEqual([
      OPENCODE_GLOBAL_AGENTS_MD,
      OPENCODE_GLOBAL_CONFIG_FILE,
    ]);
  });
});

describe('opencode global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('opencode', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .config/opencode/AGENTS.md', () => {
    expect(rewrite(OPENCODE_ROOT_RULE)).toBe(OPENCODE_GLOBAL_AGENTS_MD);
  });

  it('rewrites opencode.json to .config/opencode/opencode.json', () => {
    expect(rewrite(OPENCODE_CONFIG_FILE)).toBe(OPENCODE_GLOBAL_CONFIG_FILE);
  });

  it('keeps .config/opencode/rules/ paths unchanged', () => {
    expect(rewrite(`${OPENCODE_GLOBAL_RULES_DIR}/typescript.md`)).toBe(
      `${OPENCODE_GLOBAL_RULES_DIR}/typescript.md`,
    );
  });

  it('keeps .config/opencode/commands/ paths unchanged', () => {
    expect(rewrite(`${OPENCODE_GLOBAL_COMMANDS_DIR}/deploy.md`)).toBe(
      `${OPENCODE_GLOBAL_COMMANDS_DIR}/deploy.md`,
    );
  });

  it('keeps .config/opencode/agents/ paths unchanged', () => {
    expect(rewrite(`${OPENCODE_GLOBAL_AGENTS_DIR}/reviewer.md`)).toBe(
      `${OPENCODE_GLOBAL_AGENTS_DIR}/reviewer.md`,
    );
  });

  it('keeps .config/opencode/skills/ paths unchanged', () => {
    expect(rewrite(`${OPENCODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`)).toBe(
      `${OPENCODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`,
    );
  });
});

describe('opencode global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('opencode', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .config/opencode/skills/ to .agents/skills/', () => {
    expect(mirror(`${OPENCODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`, [])).toBe(
      '.agents/skills/api-gen/SKILL.md',
    );
  });

  it('mirrors nested supporting file under .config/opencode/skills/', () => {
    expect(mirror(`${OPENCODE_GLOBAL_SKILLS_DIR}/api-gen/references/checklist.md`, [])).toBe(
      '.agents/skills/api-gen/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror(`${OPENCODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`, ['codex-cli'])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror(OPENCODE_GLOBAL_AGENTS_MD, [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror(`${OPENCODE_GLOBAL_COMMANDS_DIR}/deploy.md`, [])).toBeNull();
  });
});

describe('opencode global layout — capabilities', () => {
  it('exposes the same capabilities in global as in project', () => {
    expect(getTargetCapabilities('opencode', 'global')).toEqual({
      rules: { level: 'native' },
      additionalRules: { level: 'native' },
      commands: { level: 'native' },
      agents: { level: 'native' },
      skills: { level: 'native' },
      mcp: { level: 'native' },
      hooks: { level: 'none' },
      ignore: { level: 'none' },
      permissions: { level: 'none' },
    });
  });

  it('descriptor.globalSupport.detectionPaths covers all global locations', () => {
    const desc = getBuiltinTargetDefinition('opencode')!;
    const paths = desc.globalSupport?.detectionPaths ?? [];
    expect(paths).toEqual([
      OPENCODE_GLOBAL_AGENTS_MD,
      OPENCODE_GLOBAL_RULES_DIR,
      OPENCODE_GLOBAL_COMMANDS_DIR,
      OPENCODE_GLOBAL_AGENTS_DIR,
      OPENCODE_GLOBAL_SKILLS_DIR,
      OPENCODE_GLOBAL_CONFIG_FILE,
    ]);
  });
});
