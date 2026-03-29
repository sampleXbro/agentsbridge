import { describe, expect, it } from 'vitest';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
  usesAgentSkillProjection,
  usesCommandSkillProjection,
} from '../../../src/config/core/conversions.js';

function makeConfig(overrides: Partial<ValidatedConfig> = {}): ValidatedConfig {
  return {
    version: 1,
    targets: ['claude-code'],
    features: ['rules'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  };
}

describe('conversion helpers', () => {
  it('reports which targets use command and agent skill projection', () => {
    expect(usesCommandSkillProjection('codex-cli')).toBe(true);
    expect(usesCommandSkillProjection('claude-code')).toBe(false);
    expect(usesAgentSkillProjection('cline')).toBe(true);
    expect(usesAgentSkillProjection('claude-code')).toBe(false);
  });

  it('uses default conversion settings when no overrides are configured', () => {
    const config = makeConfig();

    expect(shouldConvertCommandsToSkills(config, 'codex-cli')).toBe(true);
    expect(shouldConvertAgentsToSkills(config, 'gemini-cli')).toBe(false);
    expect(shouldConvertAgentsToSkills(config, 'claude-code')).toBe(false);
  });

  it('respects explicit conversion overrides', () => {
    const config = makeConfig({
      conversions: {
        commands_to_skills: { 'codex-cli': false },
        agents_to_skills: { 'gemini-cli': false, cline: false },
      },
    });

    expect(shouldConvertCommandsToSkills(config, 'codex-cli')).toBe(false);
    expect(shouldConvertAgentsToSkills(config, 'gemini-cli')).toBe(false);
    expect(shouldConvertAgentsToSkills(config, 'cline')).toBe(false);
  });

  it('returns false for unsupported targets', () => {
    const config = makeConfig();

    expect(shouldConvertCommandsToSkills(config, 'claude-code')).toBe(false);
    expect(shouldConvertAgentsToSkills(config, 'claude-code')).toBe(false);
  });
});
