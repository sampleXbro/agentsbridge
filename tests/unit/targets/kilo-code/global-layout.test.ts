import { describe, it, expect } from 'vitest';
import {
  getBuiltinTargetDefinition,
  getTargetCapabilities,
  getTargetLayout,
} from '../../../../src/targets/catalog/builtin-targets.js';
import {
  KILO_CODE_ROOT_RULE,
  KILO_CODE_GLOBAL_AGENTS_MD,
  KILO_CODE_GLOBAL_RULES_DIR,
  KILO_CODE_GLOBAL_COMMANDS_DIR,
  KILO_CODE_GLOBAL_AGENTS_DIR,
  KILO_CODE_GLOBAL_SKILLS_DIR,
  KILO_CODE_GLOBAL_MCP_FILE,
  KILO_CODE_GLOBAL_IGNORE,
} from '../../../../src/targets/kilo-code/constants.js';

describe('kilo-code global layout — paths', () => {
  const layout = getTargetLayout('kilo-code', 'global')!;

  it('resolves rule path to .kilo/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe(`${KILO_CODE_GLOBAL_RULES_DIR}/typescript.md`);
  });

  it('resolves command path to .kilo/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      `${KILO_CODE_GLOBAL_COMMANDS_DIR}/deploy.md`,
    );
  });

  it('resolves agent path to .kilo/agents/ (native first-class)', () => {
    expect(layout.paths.agentPath('reviewer', {} as never)).toBe(
      `${KILO_CODE_GLOBAL_AGENTS_DIR}/reviewer.md`,
    );
  });

  it('declares all global managed-output dirs', () => {
    expect(layout.managedOutputs.dirs).toEqual([
      KILO_CODE_GLOBAL_RULES_DIR,
      KILO_CODE_GLOBAL_COMMANDS_DIR,
      KILO_CODE_GLOBAL_AGENTS_DIR,
      KILO_CODE_GLOBAL_SKILLS_DIR,
      '.agents/skills',
    ]);
  });

  it('declares all global managed-output files', () => {
    expect(layout.managedOutputs.files).toEqual([
      KILO_CODE_GLOBAL_AGENTS_MD,
      KILO_CODE_GLOBAL_MCP_FILE,
      KILO_CODE_GLOBAL_IGNORE,
    ]);
  });
});

describe('kilo-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('kilo-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .kilo/AGENTS.md (nest under global parent)', () => {
    expect(rewrite(KILO_CODE_ROOT_RULE)).toBe(KILO_CODE_GLOBAL_AGENTS_MD);
  });

  it('keeps .kilo/rules/ paths unchanged', () => {
    expect(rewrite(`${KILO_CODE_GLOBAL_RULES_DIR}/typescript.md`)).toBe(
      `${KILO_CODE_GLOBAL_RULES_DIR}/typescript.md`,
    );
  });

  it('keeps .kilo/commands/ paths unchanged', () => {
    expect(rewrite(`${KILO_CODE_GLOBAL_COMMANDS_DIR}/deploy.md`)).toBe(
      `${KILO_CODE_GLOBAL_COMMANDS_DIR}/deploy.md`,
    );
  });

  it('keeps .kilo/agents/ paths unchanged', () => {
    expect(rewrite(`${KILO_CODE_GLOBAL_AGENTS_DIR}/reviewer.md`)).toBe(
      `${KILO_CODE_GLOBAL_AGENTS_DIR}/reviewer.md`,
    );
  });

  it('keeps .kilo/skills/ paths unchanged', () => {
    expect(rewrite(`${KILO_CODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`)).toBe(
      `${KILO_CODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`,
    );
  });

  it('keeps .kilo/mcp.json unchanged', () => {
    expect(rewrite(KILO_CODE_GLOBAL_MCP_FILE)).toBe(KILO_CODE_GLOBAL_MCP_FILE);
  });

  it('keeps .kilocodeignore unchanged', () => {
    expect(rewrite(KILO_CODE_GLOBAL_IGNORE)).toBe(KILO_CODE_GLOBAL_IGNORE);
  });
});

describe('kilo-code global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('kilo-code', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .kilo/skills/ to .agents/skills/', () => {
    expect(mirror(`${KILO_CODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`, [])).toBe(
      '.agents/skills/api-gen/SKILL.md',
    );
  });

  it('mirrors nested supporting file under .kilo/skills/', () => {
    expect(mirror(`${KILO_CODE_GLOBAL_SKILLS_DIR}/api-gen/references/checklist.md`, [])).toBe(
      '.agents/skills/api-gen/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror(`${KILO_CODE_GLOBAL_SKILLS_DIR}/api-gen/SKILL.md`, ['codex-cli'])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror(KILO_CODE_GLOBAL_AGENTS_MD, [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror(`${KILO_CODE_GLOBAL_COMMANDS_DIR}/deploy.md`, [])).toBeNull();
  });

  it('returns null for agent files (not mirrored)', () => {
    expect(mirror(`${KILO_CODE_GLOBAL_AGENTS_DIR}/reviewer.md`, [])).toBeNull();
  });
});

describe('kilo-code global layout — capabilities', () => {
  it('exposes the same native capabilities in global as in project (hooks/permissions: none)', () => {
    expect(getTargetCapabilities('kilo-code', 'global')).toEqual({
      rules: { level: 'native' },
      additionalRules: { level: 'native' },
      commands: { level: 'native' },
      agents: { level: 'native' },
      skills: { level: 'native' },
      mcp: { level: 'native' },
      hooks: { level: 'none' },
      ignore: { level: 'native' },
      permissions: { level: 'none' },
    });
  });

  it('descriptor.globalSupport.detectionPaths covers all global locations', () => {
    const desc = getBuiltinTargetDefinition('kilo-code')!;
    const paths = desc.globalSupport?.detectionPaths ?? [];
    expect(paths).toEqual([
      KILO_CODE_GLOBAL_AGENTS_MD,
      KILO_CODE_GLOBAL_RULES_DIR,
      KILO_CODE_GLOBAL_COMMANDS_DIR,
      KILO_CODE_GLOBAL_AGENTS_DIR,
      KILO_CODE_GLOBAL_SKILLS_DIR,
      KILO_CODE_GLOBAL_MCP_FILE,
      KILO_CODE_GLOBAL_IGNORE,
    ]);
  });
});
