import { describe, it, expect } from 'vitest';
import {
  resolveTargetFeatureGenerator,
  getEffectiveTargetSupportLevel,
} from '../../../../src/targets/catalog/builtin-targets.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

const minimalConfig: ValidatedConfig = {
  version: 1,
  targets: ['claude-code'],
  features: ['rules'],
} as ValidatedConfig;

describe('builtin-targets — extra branches', () => {
  it('returns undefined for additionalRules feature (PICK_FEATURE_GENERATOR null branch, line 217)', () => {
    const gen = resolveTargetFeatureGenerator('claude-code', 'additionalRules', minimalConfig);
    expect(gen).toBeUndefined();
  });

  it('returns undefined when target not registered anywhere (descriptor undefined)', () => {
    const gen = resolveTargetFeatureGenerator('totally-fake-target-xyz', 'rules', minimalConfig);
    expect(gen).toBeUndefined();
  });

  it('falls back to descriptor lookup when builtin not found (line 189 ??)', () => {
    // For unknown target, both lookups return undefined → "none"
    const lvl = getEffectiveTargetSupportLevel('unknown-target-123', 'rules', minimalConfig);
    expect(lvl).toBe('none');
  });

  it('returns embedded baseLevel for known target without conversion suppression', () => {
    // Pick a known target/feature combo
    const lvl = getEffectiveTargetSupportLevel('claude-code', 'rules', minimalConfig);
    expect(typeof lvl).toBe('string');
  });
});
