import { describe, expect, it } from 'vitest';
import { descriptor as claudeCode } from '../../../src/targets/claude-code/index.js';
import { descriptor as cursor } from '../../../src/targets/cursor/index.js';
import { descriptor as copilot } from '../../../src/targets/copilot/index.js';
import { descriptor as continueTarget } from '../../../src/targets/continue/index.js';
import { descriptor as junie } from '../../../src/targets/junie/index.js';
import { descriptor as kiro } from '../../../src/targets/kiro/index.js';
import { descriptor as geminiCli } from '../../../src/targets/gemini-cli/index.js';
import { descriptor as cline } from '../../../src/targets/cline/index.js';
import { descriptor as codexCli } from '../../../src/targets/codex-cli/index.js';
import { descriptor as windsurf } from '../../../src/targets/windsurf/index.js';
import { descriptor as antigravity } from '../../../src/targets/antigravity/index.js';
import { descriptor as rooCode } from '../../../src/targets/roo-code/index.js';
import { descriptor as kiloCode } from '../../../src/targets/kilo-code/index.js';
import { descriptor as opencode } from '../../../src/targets/opencode/index.js';
import { descriptor as goose } from '../../../src/targets/goose/index.js';
import { TARGET_IDS } from '../../../src/targets/catalog/target-ids.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';
import type { CanonicalRule } from '../../../src/core/types.js';

function baseConfig(overrides?: Partial<ValidatedConfig>): ValidatedConfig {
  return {
    version: 1,
    targets: [...TARGET_IDS],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  };
}

function makeRule(slug: string, overrides?: Partial<CanonicalRule>): CanonicalRule {
  return {
    source: `${slug}.md`,
    body: `# ${slug}`,
    root: false,
    targets: [],
    globs: [],
    description: '',
    ...overrides,
  };
}

describe('descriptor.project.paths.rulePath', () => {
  it('claude-code: returns .claude/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(claudeCode.project.paths.rulePath('example', rule)).toBe('.claude/rules/example.md');
  });

  it('cursor: returns .cursor/rules/{slug}.mdc', () => {
    const rule = makeRule('example');
    expect(cursor.project.paths.rulePath('example', rule)).toBe('.cursor/rules/example.mdc');
  });

  it('copilot: returns .github/instructions/{slug}.instructions.md', () => {
    const rule = makeRule('example');
    expect(copilot.project.paths.rulePath('example', rule)).toBe(
      '.github/instructions/example.instructions.md',
    );
  });

  it('continue: returns .continue/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(continueTarget.project.paths.rulePath('example', rule)).toBe(
      '.continue/rules/example.md',
    );
  });

  it('junie: returns .junie/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(junie.project.paths.rulePath('example', rule)).toBe('.junie/rules/example.md');
  });

  it('kiro: returns .kiro/steering/{slug}.md', () => {
    const rule = makeRule('example');
    expect(kiro.project.paths.rulePath('example', rule)).toBe('.kiro/steering/example.md');
  });

  it('gemini-cli: always returns GEMINI.md regardless of slug', () => {
    const rule = makeRule('example');
    expect(geminiCli.project.paths.rulePath('example', rule)).toBe('GEMINI.md');
    expect(geminiCli.project.paths.rulePath('other-slug', makeRule('other-slug'))).toBe(
      'GEMINI.md',
    );
  });

  it('cline: returns .clinerules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(cline.project.paths.rulePath('example', rule)).toBe('.clinerules/example.md');
  });

  it('codex-cli: returns path under .codex/instructions based on rule source', () => {
    const rule = makeRule('example');
    expect(codexCli.project.paths.rulePath('example', rule)).toBe('.codex/instructions/example.md');
  });

  it('windsurf: returns .windsurf/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(windsurf.project.paths.rulePath('example', rule)).toBe('.windsurf/rules/example.md');
  });

  it('antigravity: returns .agents/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(antigravity.project.paths.rulePath('example', rule)).toBe('.agents/rules/example.md');
  });
});

describe('descriptor.project.paths.commandPath', () => {
  const config = baseConfig();

  it('claude-code: returns .claude/commands/{name}.md', () => {
    expect(claudeCode.project.paths.commandPath('deploy', config)).toBe(
      '.claude/commands/deploy.md',
    );
  });

  it('cursor: returns .cursor/commands/{name}.md', () => {
    expect(cursor.project.paths.commandPath('deploy', config)).toBe('.cursor/commands/deploy.md');
  });

  it('copilot: returns .github/prompts/{name}.prompt.md', () => {
    expect(copilot.project.paths.commandPath('deploy', config)).toBe(
      '.github/prompts/deploy.prompt.md',
    );
  });

  it('continue: returns .continue/prompts/{name}.md', () => {
    expect(continueTarget.project.paths.commandPath('deploy', config)).toBe(
      '.continue/prompts/deploy.md',
    );
  });

  it('junie: returns .junie/commands/{name}.md', () => {
    expect(junie.project.paths.commandPath('deploy', config)).toBe('.junie/commands/deploy.md');
  });

  it('kiro: returns null (commands unsupported)', () => {
    expect(kiro.project.paths.commandPath('deploy', config)).toBeNull();
  });

  it('gemini-cli simple: returns .gemini/commands/{name}.toml', () => {
    expect(geminiCli.project.paths.commandPath('deploy', config)).toBe(
      '.gemini/commands/deploy.toml',
    );
  });

  it('gemini-cli namespaced: returns .gemini/commands/{ns}/{name}.toml', () => {
    expect(geminiCli.project.paths.commandPath('ops:deploy', config)).toBe(
      '.gemini/commands/ops/deploy.toml',
    );
  });

  it('cline: returns .clinerules/workflows/{name}.md', () => {
    expect(cline.project.paths.commandPath('deploy', config)).toBe(
      '.clinerules/workflows/deploy.md',
    );
  });

  it('codex-cli with conversion ON (default): returns path under .agents/skills/', () => {
    const result = codexCli.project.paths.commandPath('deploy', config);
    expect(result).toBe('.agents/skills/am-command-deploy/SKILL.md');
  });

  it('codex-cli with conversion OFF: returns null', () => {
    const configWithConversionOff = baseConfig({
      conversions: { commands_to_skills: { 'codex-cli': false } },
    });
    expect(codexCli.project.paths.commandPath('deploy', configWithConversionOff)).toBeNull();
  });

  it('windsurf: returns .windsurf/workflows/{name}.md', () => {
    expect(windsurf.project.paths.commandPath('deploy', config)).toBe(
      '.windsurf/workflows/deploy.md',
    );
  });

  it('antigravity: returns .agents/workflows/{name}.md', () => {
    expect(antigravity.project.paths.commandPath('deploy', config)).toBe(
      '.agents/workflows/deploy.md',
    );
  });
});

describe('descriptor.project.paths.agentPath', () => {
  const config = baseConfig();

  it('claude-code: returns .claude/agents/{name}.md', () => {
    expect(claudeCode.project.paths.agentPath('reviewer', config)).toBe(
      '.claude/agents/reviewer.md',
    );
  });

  it('cursor: returns .cursor/agents/{name}.md', () => {
    expect(cursor.project.paths.agentPath('reviewer', config)).toBe('.cursor/agents/reviewer.md');
  });

  it('copilot: returns .github/agents/{name}.agent.md', () => {
    expect(copilot.project.paths.agentPath('reviewer', config)).toBe(
      '.github/agents/reviewer.agent.md',
    );
  });

  it('continue: returns null (agents: none)', () => {
    expect(continueTarget.project.paths.agentPath('reviewer', config)).toBeNull();
  });

  it('junie: returns .junie/agents/{name}.md', () => {
    expect(junie.project.paths.agentPath('reviewer', config)).toBe('.junie/agents/reviewer.md');
  });

  it('kiro: returns .kiro/agents/{name}.md', () => {
    expect(kiro.project.paths.agentPath('reviewer', config)).toBe('.kiro/agents/reviewer.md');
  });

  it('gemini-cli default (conversion OFF): returns .gemini/agents/{name}.md', () => {
    expect(geminiCli.project.paths.agentPath('reviewer', config)).toBe(
      '.gemini/agents/reviewer.md',
    );
  });

  it('gemini-cli with conversion ON: returns path under .gemini/skills/', () => {
    const configWithAgentConversion = baseConfig({
      conversions: { agents_to_skills: { 'gemini-cli': true } },
    });
    const result = geminiCli.project.paths.agentPath('reviewer', configWithAgentConversion);
    expect(result).toBe('.gemini/skills/am-agent-reviewer/SKILL.md');
  });

  it('cline default (conversion ON): returns path under .cline/skills/', () => {
    const result = cline.project.paths.agentPath('reviewer', config);
    expect(result).toBe('.cline/skills/am-agent-reviewer/SKILL.md');
  });

  it('cline with conversion OFF: returns null', () => {
    const configWithConversionOff = baseConfig({
      conversions: { agents_to_skills: { cline: false } },
    });
    expect(cline.project.paths.agentPath('reviewer', configWithConversionOff)).toBeNull();
  });

  it('codex-cli: returns .codex/agents/{name}.toml', () => {
    expect(codexCli.project.paths.agentPath('reviewer', config)).toBe(
      '.codex/agents/reviewer.toml',
    );
  });

  it('windsurf default (conversion ON): returns path under .windsurf/skills/', () => {
    const result = windsurf.project.paths.agentPath('reviewer', config);
    expect(result).toBe('.windsurf/skills/am-agent-reviewer/SKILL.md');
  });

  it('windsurf with conversion OFF: returns null', () => {
    const configWithConversionOff = baseConfig({
      conversions: { agents_to_skills: { windsurf: false } },
    });
    expect(windsurf.project.paths.agentPath('reviewer', configWithConversionOff)).toBeNull();
  });

  it('antigravity: returns null (agents: none)', () => {
    expect(antigravity.project.paths.agentPath('reviewer', config)).toBeNull();
  });
});

describe('descriptor metadata', () => {
  // Per-target list (NOT BUILTIN_TARGETS): importing each descriptor directly
  // here would otherwise re-trigger the catalog mid-evaluation and leave some
  // BUILTIN_TARGETS slots `undefined` under vitest's module loader. Drift is
  // caught separately by tests/unit/targets/catalog/builtin-catalog.test.ts.
  const allDescriptors = [
    claudeCode,
    cursor,
    copilot,
    continueTarget,
    junie,
    kiro,
    geminiCli,
    cline,
    codexCli,
    windsurf,
    antigravity,
    rooCode,
    kiloCode,
    opencode,
    goose,
  ];

  const allFeatureKeys = [
    'rules',
    'commands',
    'agents',
    'skills',
    'mcp',
    'hooks',
    'ignore',
    'permissions',
  ] as const;

  it('every descriptor id is present in TARGET_IDS', () => {
    const descriptorIds = allDescriptors.map((d) => d.id);
    expect([...descriptorIds].sort()).toStrictEqual([...TARGET_IDS].sort());
  });

  it('all descriptors have non-empty detectionPaths', () => {
    for (const d of allDescriptors) {
      expect(d.detectionPaths.length).toBeGreaterThan(0);
    }
  });

  it('all descriptors have non-null generators', () => {
    for (const d of allDescriptors) {
      expect(d.generators).not.toBeNull();
      expect(d.generators).toBeDefined();
    }
  });

  it('all descriptors have defined capabilities with all 8 feature keys', () => {
    for (const d of allDescriptors) {
      for (const key of allFeatureKeys) {
        expect(d.capabilities[key], `${d.id} is missing capabilities.${key}`).toBeDefined();
      }
    }
  });
});
