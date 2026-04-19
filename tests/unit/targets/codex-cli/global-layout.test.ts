import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('codex-cli global layout — paths', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;

  it('resolves rule path to .codex/AGENTS.md (aggregate for advisory rules)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.codex/AGENTS.md');
  });

  it('resolves command path to .agents/skills/ (embedded as skill)', () => {
    expect(
      layout.paths.commandPath('deploy', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
        conversions: { commands_to_skills: { 'codex-cli': true } },
      }),
    ).toBe('.agents/skills/am-command-deploy/SKILL.md');
  });

  it('resolves agent path to .codex/agents/', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.codex/agents/my-agent.toml');
  });
});

describe('codex-cli global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .codex/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.codex/AGENTS.md');
  });

  it('keeps .agents/skills/ paths unchanged', () => {
    expect(rewrite('.agents/skills/ts-pro/SKILL.md')).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('keeps .codex/agents/ paths unchanged', () => {
    expect(rewrite('.codex/agents/my-agent.toml')).toBe('.codex/agents/my-agent.toml');
  });

  it('suppresses .codex/instructions/ in global mode (returns null)', () => {
    expect(rewrite('.codex/instructions/typescript.md')).toBeNull();
  });

  it('keeps .codex/config.toml unchanged', () => {
    expect(rewrite('.codex/config.toml')).toBe('.codex/config.toml');
  });
});

describe('codex-cli global layout — no mirrorGlobalPath', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;

  it('has no mirrorGlobalPath (skills already in .agents/)', () => {
    expect(layout.mirrorGlobalPath).toBeUndefined();
  });
});
