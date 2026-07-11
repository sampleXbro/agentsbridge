import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_FEATURES,
  CAPABILITY_SCOPES,
  LEVEL_RANK,
} from '../../../../src/core/capabilities/ledger-types.js';

describe('LEVEL_RANK', () => {
  it('orders none < partial < embedded < native', () => {
    expect(LEVEL_RANK.none).toBeLessThan(LEVEL_RANK.partial);
    expect(LEVEL_RANK.partial).toBeLessThan(LEVEL_RANK.embedded);
    expect(LEVEL_RANK.embedded).toBeLessThan(LEVEL_RANK.native);
  });

  it('has the exact rank values', () => {
    expect(LEVEL_RANK).toEqual({ none: 0, partial: 1, embedded: 2, native: 3 });
  });
});

describe('capability constants', () => {
  it('lists exactly the nine capability features in order', () => {
    expect(CAPABILITY_FEATURES).toEqual([
      'rules',
      'additionalRules',
      'commands',
      'agents',
      'skills',
      'mcp',
      'hooks',
      'ignore',
      'permissions',
    ]);
  });

  it('lists exactly the two scopes', () => {
    expect(CAPABILITY_SCOPES).toEqual(['project', 'global']);
  });
});
