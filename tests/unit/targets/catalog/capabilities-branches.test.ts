import { describe, it, expect } from 'vitest';
import {
  cap,
  normalizeCapabilityValue,
  normalizeTargetCapabilities,
} from '../../../../src/targets/catalog/capabilities.js';

describe('capabilities branches', () => {
  it('cap returns { level } when flavor is undefined', () => {
    expect(cap('native')).toEqual({ level: 'native' });
  });

  it('cap returns { level, flavor } when flavor is provided', () => {
    expect(cap('partial', 'workflows')).toEqual({ level: 'partial', flavor: 'workflows' });
  });

  it('normalizeCapabilityValue wraps a bare string level into an object', () => {
    expect(normalizeCapabilityValue('embedded')).toEqual({ level: 'embedded' });
  });

  it('normalizeCapabilityValue passes through an object input', () => {
    expect(normalizeCapabilityValue({ level: 'native', flavor: 'standard' })).toEqual({
      level: 'native',
      flavor: 'standard',
    });
  });

  it('normalizeTargetCapabilities normalizes all 9 feature keys uniformly', () => {
    const out = normalizeTargetCapabilities({
      rules: 'native',
      additionalRules: 'native',
      commands: { level: 'partial', flavor: 'workflows' },
      agents: 'embedded',
      skills: 'native',
      mcp: 'none',
      hooks: 'none',
      ignore: 'native',
      permissions: 'none',
    });
    expect(out.rules.level).toBe('native');
    expect(out.commands.flavor).toBe('workflows');
    expect(out.permissions).toEqual({ level: 'none' });
  });
});
