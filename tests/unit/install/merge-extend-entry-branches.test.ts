import { describe, it, expect } from 'vitest';
import { mergeExtendList } from '../../../src/install/core/merge-extend-entry.js';

describe('mergeExtendList — branch gaps in mergePick', () => {
  it('returns pick=undefined when no existing pick and incoming has no pick', () => {
    const merged = mergeExtendList([{ name: 'a', source: 'github:o/r@v', features: ['rules'] }], {
      name: 'a',
      source: 'github:o/r@v',
      features: ['rules'],
    });
    expect(merged[0]!.pick).toBeUndefined();
  });

  it('clears partial picks when incoming features cover only a subset', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@v',
          features: ['skills', 'commands'],
          pick: { skills: ['x'], commands: ['c'], rules: ['r'] },
        },
      ],
      { name: 'a', source: 'github:o/r@v', features: ['skills'] },
    );
    // Skills entry deleted, commands/rules preserved.
    expect(merged[0]!.pick).toEqual({ commands: ['c'], rules: ['r'] });
  });

  it('returns undefined pick when incoming pick is undefined and all old picks are cleared by features', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@v',
          features: ['skills'],
          pick: { skills: ['x'] },
        },
      ],
      { name: 'a', source: 'github:o/r@v', features: ['skills'] },
    );
    expect(merged[0]!.pick).toBeUndefined();
  });

  it('drops a category from incoming pick when value is undefined and unions otherwise', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@v',
          features: ['skills', 'rules'],
          pick: { skills: ['x'], rules: ['r1'] },
        },
      ],
      {
        name: 'a',
        source: 'github:o/r@v',
        features: ['skills', 'rules'],
        pick: { skills: undefined as never, rules: ['r2'] },
      },
    );
    expect(merged[0]!.pick).toEqual({ rules: ['r1', 'r2'] });
  });

  it('appends entries with all optional fields (target, as, path, version, pick) when source is new', () => {
    const merged = mergeExtendList([], {
      name: 'n',
      source: 'github:o/r@v',
      version: 'v1',
      path: 'sub',
      target: 'cursor',
      as: 'rules',
      features: ['rules'],
      pick: { rules: ['root'] },
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: 'n',
      version: 'v1',
      path: 'sub',
      target: 'cursor',
      as: 'rules',
      pick: { rules: ['root'] },
    });
  });
});
