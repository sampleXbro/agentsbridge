import { describe, expect, it } from 'vitest';
import {
  cap,
  normalizeCapabilityValue,
  normalizeTargetCapabilities,
} from '../../../src/targets/catalog/capabilities.js';

describe('normalizeCapabilityValue', () => {
  it('wraps legacy string levels', () => {
    expect(normalizeCapabilityValue('native')).toEqual({ level: 'native' });
  });

  it('preserves flavor', () => {
    expect(normalizeCapabilityValue(cap('native', 'workflows'))).toEqual({
      level: 'native',
      flavor: 'workflows',
    });
  });
});

describe('normalizeTargetCapabilities', () => {
  it('normalizes mixed legacy and object shapes', () => {
    const n = normalizeTargetCapabilities({
      rules: 'native',
      commands: cap('partial', 'workflows'),
      agents: 'none',
      skills: 'native',
      mcp: 'none',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    });
    expect(n.rules).toEqual({ level: 'native' });
    expect(n.commands).toEqual({ level: 'partial', flavor: 'workflows' });
  });
});
