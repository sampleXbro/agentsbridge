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

describe('descriptor.paths.rulePath', () => {
  it('claude-code: returns .claude/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(claudeCode.paths.rulePath('example', rule)).toBe('.claude/rules/example.md');
  });

  it('cursor: returns .cursor/rules/{slug}.mdc', () => {
    const rule = makeRule('example');
    expect(cursor.paths.rulePath('example', rule)).toBe('.cursor/rules/example.mdc');
  });

  it('copilot: returns .github/instructions/{slug}.instructions.md', () => {
    const rule = makeRule('example');
    expect(copilot.paths.rulePath('example', rule)).toBe(
      '.github/instructions/example.instructions.md',
    );
  });

  it('continue: returns .continue/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(continueTarget.paths.rulePath('example', rule)).toBe('.continue/rules/example.md');
  });

  it('junie: returns .junie/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(junie.paths.rulePath('example', rule)).toBe('.junie/rules/example.md');
  });

  it('kiro: returns .kiro/steering/{slug}.md', () => {
    const rule = makeRule('example');
    expect(kiro.paths.rulePath('example', rule)).toBe('.kiro/steering/example.md');
  });

  it('gemini-cli: always returns GEMINI.md regardless of slug', () => {
    const rule = makeRule('example');
    expect(geminiCli.paths.rulePath('example', rule)).toBe('GEMINI.md');
    expect(geminiCli.paths.rulePath('other-slug', makeRule('other-slug'))).toBe('GEMINI.md');
  });

  it('cline: returns .clinerules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(cline.paths.rulePath('example', rule)).toBe('.clinerules/example.md');
  });

  it('codex-cli: returns path under .codex/instructions based on rule source', () => {
    const rule = makeRule('example');
    expect(codexCli.paths.rulePath('example', rule)).toBe('.codex/instructions/example.md');
  });

  it('windsurf: returns .windsurf/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(windsurf.paths.rulePath('example', rule)).toBe('.windsurf/rules/example.md');
  });

  it('antigravity: returns .agents/rules/{slug}.md', () => {
    const rule = makeRule('example');
    expect(antigravity.paths.rulePath('example', rule)).toBe('.agents/rules/example.md');
  });
});

describe('descriptor.paths.commandPath', () => {
  const config = baseConfig();

  it('claude-code: returns .claude/commands/{name}.md', () => {
    expect(claudeCode.paths.commandPath('deploy', config)).toBe('.claude/commands/deploy.md');
  });

  it('cursor: returns .cursor/commands/{name}.md', () => {
    expect(cursor.paths.commandPath('deploy', config)).toBe('.cursor/commands/deploy.md');
  });

  it('copilot: returns .github/prompts/{name}.prompt.md', () => {
    expect(copilot.paths.commandPath('deploy', config)).toBe('.github/prompts/deploy.prompt.md');
  });

  it('continue: returns .continue/prompts/{name}.md', () => {
    expect(continueTarget.paths.commandPath('deploy', config)).toBe('.continue/prompts/deploy.md');
  });

  it('junie: returns .junie/commands/{name}.md', () => {
    expect(junie.paths.commandPath('deploy', config)).toBe('.junie/commands/deploy.md');
  });

  it('kiro: returns null (commands unsupported)', () => {
    expect(kiro.paths.commandPath('deploy', config)).toBeNull();
  });

  it('gemini-cli simple: returns .gemini/commands/{name}.toml', () => {
    expect(geminiCli.paths.commandPath('deploy', config)).toBe('.gemini/commands/deploy.toml');
  });

  it('gemini-cli namespaced: returns .gemini/commands/{ns}/{name}.toml', () => {
    expect(geminiCli.paths.commandPath('ops:deploy', config)).toBe(
      '.gemini/commands/ops/deploy.toml',
    );
  });

  it('cline: returns .clinerules/workflows/{name}.md', () => {
    expect(cline.paths.commandPath('deploy', config)).toBe('.clinerules/workflows/deploy.md');
  });

  it('codex-cli with conversion ON (default): returns path under .agents/skills/', () => {
    const result = codexCli.paths.commandPath('deploy', config);
    expect(result).toBe('.agents/skills/am-command-deploy/SKILL.md');
  });

  it('codex-cli with conversion OFF: returns null', () => {
    const configWithConversionOff = baseConfig({
      conversions: { commands_to_skills: { 'codex-cli': false } },
    });
    expect(codexCli.paths.commandPath('deploy', configWithConversionOff)).toBeNull();
  });

  it('windsurf: returns .windsurf/workflows/{name}.md', () => {
    expect(windsurf.paths.commandPath('deploy', config)).toBe('.windsurf/workflows/deploy.md');
  });

  it('antigravity: returns .agents/workflows/{name}.md', () => {
    expect(antigravity.paths.commandPath('deploy', config)).toBe('.agents/workflows/deploy.md');
  });
});

describe('descriptor.paths.agentPath', () => {
  const config = baseConfig();

  it('claude-code: returns .claude/agents/{name}.md', () => {
    expect(claudeCode.paths.agentPath('reviewer', config)).toBe('.claude/agents/reviewer.md');
  });

  it('cursor: returns .cursor/agents/{name}.md', () => {
    expect(cursor.paths.agentPath('reviewer', config)).toBe('.cursor/agents/reviewer.md');
  });

  it('copilot: returns .github/agents/{name}.agent.md', () => {
    expect(copilot.paths.agentPath('reviewer', config)).toBe('.github/agents/reviewer.agent.md');
  });

  it('continue: returns null (agents: none)', () => {
    expect(continueTarget.paths.agentPath('reviewer', config)).toBeNull();
  });

  it('junie: returns .junie/agents/{name}.md', () => {
    expect(junie.paths.agentPath('reviewer', config)).toBe('.junie/agents/reviewer.md');
  });

  it('kiro: returns null (agents unsupported)', () => {
    expect(kiro.paths.agentPath('reviewer', config)).toBeNull();
  });

  it('gemini-cli default (conversion OFF): returns .gemini/agents/{name}.md', () => {
    expect(geminiCli.paths.agentPath('reviewer', config)).toBe('.gemini/agents/reviewer.md');
  });

  it('gemini-cli with conversion ON: returns path under .gemini/skills/', () => {
    const configWithAgentConversion = baseConfig({
      conversions: { agents_to_skills: { 'gemini-cli': true } },
    });
    const result = geminiCli.paths.agentPath('reviewer', configWithAgentConversion);
    expect(result).toBe('.gemini/skills/am-agent-reviewer/SKILL.md');
  });

  it('cline default (conversion ON): returns path under .cline/skills/', () => {
    const result = cline.paths.agentPath('reviewer', config);
    expect(result).toBe('.cline/skills/am-agent-reviewer/SKILL.md');
  });

  it('cline with conversion OFF: returns null', () => {
    const configWithConversionOff = baseConfig({
      conversions: { agents_to_skills: { cline: false } },
    });
    expect(cline.paths.agentPath('reviewer', configWithConversionOff)).toBeNull();
  });

  it('codex-cli: returns .codex/agents/{name}.toml', () => {
    expect(codexCli.paths.agentPath('reviewer', config)).toBe('.codex/agents/reviewer.toml');
  });

  it('windsurf default (conversion ON): returns path under .windsurf/skills/', () => {
    const result = windsurf.paths.agentPath('reviewer', config);
    expect(result).toBe('.windsurf/skills/am-agent-reviewer/SKILL.md');
  });

  it('windsurf with conversion OFF: returns null', () => {
    const configWithConversionOff = baseConfig({
      conversions: { agents_to_skills: { windsurf: false } },
    });
    expect(windsurf.paths.agentPath('reviewer', configWithConversionOff)).toBeNull();
  });

  it('antigravity: returns null (agents: none)', () => {
    expect(antigravity.paths.agentPath('reviewer', config)).toBeNull();
  });
});

describe('descriptor metadata', () => {
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

  it('all 12 descriptors have ids matching TARGET_IDS', () => {
    const descriptorIds = allDescriptors.map((d) => d.id);
    expect(descriptorIds).toHaveLength(12);
    for (const id of descriptorIds) {
      expect(TARGET_IDS).toContain(id);
    }
    for (const id of TARGET_IDS) {
      expect(descriptorIds).toContain(id);
    }
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
