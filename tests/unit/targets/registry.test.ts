import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTarget,
  getTarget,
  getAllTargets,
  resetRegistry,
} from '../../../src/targets/registry.js';
import type { TargetGenerators } from '../../../src/targets/target.interface.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

const mockGenerators: TargetGenerators = {
  name: 'test-target',
  generateRules: (_c: CanonicalFiles) => [],
  importFrom: async () => [],
};

describe('target registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('registers and retrieves a target', () => {
    registerTarget(mockGenerators);
    expect(getTarget('test-target')).toBe(mockGenerators);
  });

  it('returns all registered targets', () => {
    const t1: TargetGenerators = { ...mockGenerators, name: 'a' };
    const t2: TargetGenerators = { ...mockGenerators, name: 'b' };
    registerTarget(t1);
    registerTarget(t2);
    expect(getAllTargets()).toHaveLength(2);
  });

  it('throws for unknown target', () => {
    expect(() => getTarget('nonexistent')).toThrow('Unknown target: nonexistent');
  });

  it('resetRegistry clears all targets', () => {
    registerTarget(mockGenerators);
    resetRegistry();
    expect(getAllTargets()).toHaveLength(0);
  });
});
