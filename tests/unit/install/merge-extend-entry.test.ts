import { describe, it, expect } from 'vitest';
import { mergeExtendList } from '../../../src/install/merge-extend-entry.js';
import type { ValidatedConfig } from '../../../src/config/schema.js';

const baseConfig = (): ValidatedConfig['extends'] => [
  {
    name: 'a',
    source: 'github:o/r@abc',
    features: ['skills'],
    pick: { skills: ['x'] },
  },
];

describe('mergeExtendList', () => {
  it('appends when source differs', () => {
    const merged = mergeExtendList(baseConfig(), {
      name: 'b',
      source: 'github:o/other@def',
      features: ['skills'],
    });
    expect(merged).toHaveLength(2);
    expect(merged[1]!.source).toBe('github:o/other@def');
  });

  it('merges same source features and pick union', () => {
    const merged = mergeExtendList(baseConfig(), {
      name: 'a',
      source: 'github:o/r@abc',
      features: ['rules'],
      pick: { skills: ['y'] },
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]!.features.sort()).toEqual(['rules', 'skills'].sort());
    expect(merged[0]!.pick?.skills?.sort()).toEqual(['x', 'y'].sort());
  });

  it('clears pick for feature when incoming has no pick', () => {
    const merged = mergeExtendList(baseConfig(), {
      name: 'a',
      source: 'github:o/r@abc',
      features: ['skills'],
    });
    expect(merged[0]!.pick).toBeUndefined();
  });
});
