/**
 * `buildCacheKey` must never map two different sources to one cache directory.
 * The readable prefix is lossy, so every key carries a hash of the raw inputs.
 */

import { describe, expect, it } from 'vitest';
import { buildCacheKey } from '../../../src/config/remote/remote-fetcher.js';

const KEY_SHAPE = /^[A-Za-z0-9_.-]+--[0-9a-f]{12}$/;

describe('buildCacheKey — collision resistance', () => {
  it('separates a ref containing "--" from a repo containing "--"', () => {
    const a = buildCacheKey('github', 'foo/bar', 'baz--v1');
    const b = buildCacheKey('github', 'foo/bar--baz', 'v1');
    expect(a).not.toBe(b);
  });

  it('separates git URLs whose "/" and "_" escape to the same text', () => {
    const a = buildCacheKey('git', 'https://h/a/b.git', 'v1');
    const b = buildCacheKey('git', 'https://h/a_b.git', 'v1');
    expect(a).not.toBe(b);
  });

  it('separates a nested gitlab namespace from a flat one', () => {
    const a = buildCacheKey('gitlab', 'group/sub/proj', 'main');
    const b = buildCacheKey('gitlab', 'group_sub/proj', 'main');
    expect(a).not.toBe(b);
  });

  it('separates providers that share an identifier and ref', () => {
    const a = buildCacheKey('gitlab', 'org/repo', 'v1');
    const b = buildCacheKey('git', 'org/repo', 'v1');
    expect(a).not.toBe(b);
  });
});

describe('buildCacheKey — shape', () => {
  it('is deterministic and keeps a readable github prefix', () => {
    const key = buildCacheKey('github', 'org/repo', 'v1.2.3');
    expect(key).toBe(buildCacheKey('github', 'org/repo', 'v1.2.3'));
    expect(key).toMatch(/^org--repo--v1\.2\.3--[0-9a-f]{12}$/);
  });

  it('keeps a readable non-github prefix', () => {
    expect(buildCacheKey('gitlab', 'ns/project', 'abc')).toMatch(
      /^gitlab__ns_project__abc--[0-9a-f]{12}$/,
    );
  });

  it('caps long keys at 80 chars while keeping them distinct', () => {
    const longRef = 'x'.repeat(200);
    const a = buildCacheKey('git', 'https://example.com/org/repo.git', longRef);
    const b = buildCacheKey('git', 'https://example.com/org/repo.git', `${longRef}y`);
    expect(a.length).toBe(80);
    expect(b.length).toBe(80);
    expect(a).not.toBe(b);
    expect(a).toMatch(KEY_SHAPE);
  });

  it('never produces a path separator or a leading dot', () => {
    expect(buildCacheKey('git', '../../etc', '..')).toMatch(KEY_SHAPE);
  });
});
