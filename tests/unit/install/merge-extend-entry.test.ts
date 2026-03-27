import { describe, it, expect } from 'vitest';
import {
  assertExtendNameAvailable,
  mergeExtendList,
} from '../../../src/install/core/merge-extend-entry.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const baseConfig = (): ValidatedConfig['extends'] => [
  {
    name: 'a',
    source: 'github:o/r@abc',
    features: ['skills'],
    pick: { skills: ['x'] },
  },
];

describe('mergeExtendList', () => {
  it('throws when the same extend name points at a different source', () => {
    expect(() =>
      assertExtendNameAvailable(baseConfig(), {
        name: 'a',
        source: 'github:o/other@def',
        features: ['skills'],
      }),
    ).toThrow(/already exists/);

    expect(() =>
      assertExtendNameAvailable(baseConfig(), {
        name: 'a',
        source: 'github:o/r@abc',
        features: ['skills'],
      }),
    ).not.toThrow();
  });

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

  it('retains unrelated picks when incoming features omit them and deletes empty incoming picks', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@abc',
          features: ['skills', 'rules'],
          pick: { skills: ['x'], rules: ['root'], commands: ['review'] },
        },
      ],
      {
        name: 'a',
        source: 'github:o/r@abc',
        features: ['skills', 'commands'],
        pick: { skills: [], commands: [] },
      },
    );

    expect(merged[0]!.pick).toEqual({ rules: ['root'] });
  });

  it('preserves previous version and path when omitted and accepts incoming target overrides', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@abc',
          version: 'v1',
          path: 'skills',
          target: 'cursor',
          features: ['skills'],
        },
      ],
      {
        name: 'a',
        source: 'github:o/r@abc',
        features: ['rules'],
        target: 'claude-code',
      },
    );

    expect(merged[0]).toMatchObject({
      version: 'v1',
      path: 'skills',
      target: 'claude-code',
      features: ['skills', 'rules'],
    });
  });

  it('unions incoming picks onto an existing source and preserves other entries', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@abc',
          path: 'skills',
          features: ['skills'],
          pick: { skills: ['x'] },
        },
        {
          name: 'b',
          source: 'github:o/other@def',
          features: ['rules'],
        },
      ],
      {
        name: 'a',
        source: 'github:o/r@abc',
        path: 'commands',
        features: ['skills'],
        pick: { skills: ['y'] },
      },
    );

    expect(merged[0]).toMatchObject({
      path: 'commands',
      pick: { skills: ['x', 'y'] },
    });
    expect(merged[1]).toMatchObject({
      name: 'b',
      source: 'github:o/other@def',
    });
  });

  it('drops pick entirely when incoming pick is an empty object', () => {
    const merged = mergeExtendList(
      [
        {
          name: 'a',
          source: 'github:o/r@abc',
          features: ['skills'],
        },
      ],
      {
        name: 'a',
        source: 'github:o/r@abc',
        features: ['rules'],
        pick: {},
      },
    );

    expect(merged[0]!.pick).toBeUndefined();
  });
});
