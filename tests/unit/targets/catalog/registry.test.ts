import { describe, it, expect, beforeEach } from 'vitest';
import type { TargetGenerators } from '../../../../src/targets/catalog/target.interface.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';
import {
  registerTarget,
  registerTargetDescriptor,
  getTarget,
  getAllTargets,
  getAllDescriptors,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';

function makeLegacyTarget(name: string): TargetGenerators {
  return {
    name,
    generateRules: () => [],
    importFrom: async () => [],
  };
}

function makeDescriptor(id: string): TargetDescriptor {
  return {
    id,
    generators: makeLegacyTarget(id),
  } as unknown as TargetDescriptor;
}

beforeEach(() => {
  resetRegistry();
});

describe('registerTarget / getTarget (legacy path)', () => {
  it('registers a legacy target and retrieves it via getTarget', () => {
    const target = makeLegacyTarget('legacy-one');
    registerTarget(target);
    expect(getTarget('legacy-one')).toBe(target);
  });

  it('getTarget prefers descriptor generators over legacy when both exist', () => {
    const legacy = makeLegacyTarget('shared-id');
    const desc = makeDescriptor('shared-id');
    registerTarget(legacy);
    registerTargetDescriptor(desc);
    expect(getTarget('shared-id')).toBe(desc.generators);
  });

  it('getTarget throws for completely unknown target', () => {
    expect(() => getTarget('no-such-target-xyz')).toThrow(/Unknown target/);
  });

  it('getTarget throws with the unknown target name in the message', () => {
    expect(() => getTarget('mystery-target')).toThrow('mystery-target');
  });
});

describe('getAllTargets', () => {
  it('returns empty array when no legacy targets registered', () => {
    expect(getAllTargets()).toHaveLength(0);
  });

  it('returns all registered legacy targets', () => {
    const t1 = makeLegacyTarget('l-one');
    const t2 = makeLegacyTarget('l-two');
    registerTarget(t1);
    registerTarget(t2);
    const all = getAllTargets();
    expect(all).toContain(t1);
    expect(all).toContain(t2);
    expect(all).toHaveLength(2);
  });

  it('is cleared by resetRegistry', () => {
    registerTarget(makeLegacyTarget('l-three'));
    resetRegistry();
    expect(getAllTargets()).toHaveLength(0);
  });
});

describe('getAllDescriptors', () => {
  it('returns empty array when no plugin descriptors registered', () => {
    expect(getAllDescriptors()).toHaveLength(0);
  });

  it('returns all registered plugin descriptors', () => {
    const d1 = makeDescriptor('plugin-a');
    const d2 = makeDescriptor('plugin-b');
    registerTargetDescriptor(d1);
    registerTargetDescriptor(d2);
    const all = getAllDescriptors();
    expect(all.map((d) => d.id)).toContain('plugin-a');
    expect(all.map((d) => d.id)).toContain('plugin-b');
    expect(all).toHaveLength(2);
  });

  it('is cleared by resetRegistry', () => {
    registerTargetDescriptor(makeDescriptor('plugin-c'));
    resetRegistry();
    expect(getAllDescriptors()).toHaveLength(0);
  });
});
