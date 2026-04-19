import { describe, it, expect } from 'vitest';
import { getBuiltinTargetDefinition } from '../../src/targets/catalog/builtin-targets.js';
import { TARGET_IDS } from '../../src/targets/catalog/target-ids.js';
import { GLOBAL_ROUNDTRIP_E2E_TARGET_IDS } from './helpers/global-roundtrip-target-registry.js';

describe('global round-trip e2e catalog', () => {
  it('every builtin target with descriptor.global is listed for round-trip coverage', () => {
    const fromDescriptors = TARGET_IDS.filter((id) => {
      const globalLayout = getBuiltinTargetDefinition(id)?.global;
      return globalLayout !== undefined && globalLayout !== null;
    }).sort();
    const fromRegistry = [...GLOBAL_ROUNDTRIP_E2E_TARGET_IDS].sort();
    expect(fromRegistry).toEqual(fromDescriptors);
  });
});
