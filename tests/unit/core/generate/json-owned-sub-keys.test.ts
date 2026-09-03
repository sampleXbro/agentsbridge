/**
 * `mergeOwnedJsonSubKeys` is the one-level-down twin of `mergeOwnedJsonKeys`.
 * It exists for `~/.junie/allowlist.json`: agentsmesh maps canonical
 * permissions into a single category of `rules`, so owning the whole `rules`
 * key would erase every other approval the user accumulated there.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeOwnedJsonSubKeys,
  ownedJsonSubKeysMerger,
} from '../../../../src/core/generate/json-owned-keys.js';

const GENERATED = JSON.stringify({
  defaultBehavior: 'ask',
  rules: { executables: { rules: ['fresh'] }, fileEditing: { rules: [] } },
});

describe('mergeOwnedJsonSubKeys', () => {
  it('replaces only the owned sub-keys and keeps every other key', () => {
    const base = JSON.stringify({
      defaultBehavior: 'allow',
      rules: { executables: { rules: ['stale'] }, readSecretFile: { rules: ['.env'] } },
    });

    const merged = JSON.parse(mergeOwnedJsonSubKeys(base, GENERATED, 'rules', ['executables'])!);

    expect(merged).toEqual({
      defaultBehavior: 'allow',
      rules: { readSecretFile: { rules: ['.env'] }, executables: { rules: ['fresh'] } },
    });
  });

  it('drops an owned sub-key the generated content no longer carries', () => {
    const base = JSON.stringify({ rules: { executables: { rules: ['stale'] } } });
    const merged = JSON.parse(
      mergeOwnedJsonSubKeys(base, JSON.stringify({ rules: {} }), 'rules', ['executables'])!,
    );
    expect(merged).toEqual({ rules: {} });
  });

  it('treats a missing or non-object container as empty', () => {
    const merged = JSON.parse(
      mergeOwnedJsonSubKeys('{"other":1}', '{"rules":7}', 'rules', ['executables'])!,
    );
    expect(merged).toEqual({ other: 1, rules: {} });
  });

  it('returns null when there is no base to merge into', () => {
    expect(mergeOwnedJsonSubKeys(null, GENERATED, 'rules', ['executables'])).toBeNull();
    expect(mergeOwnedJsonSubKeys('   ', GENERATED, 'rules', ['executables'])).toBeNull();
  });

  it('returns null when the generated content is not a JSON object', () => {
    expect(mergeOwnedJsonSubKeys('{}', 'not json', 'rules', ['executables'])).toBeNull();
  });

  it('preserves a base it cannot parse rather than costing the user the file', () => {
    expect(mergeOwnedJsonSubKeys('// comments\n{', GENERATED, 'rules', ['executables'])).toBe(
      '// comments\n{',
    );
  });
});

describe('ownedJsonSubKeysMerger', () => {
  const merger = ownedJsonSubKeysMerger(['.junie/allowlist.json'], 'rules', ['executables']);

  it('declines a path it does not claim', () => {
    expect(merger('{}', undefined, GENERATED, '.junie/config.json')).toBeNull();
  });

  it('prefers the pending result over what is on disk', () => {
    const merged = merger(
      JSON.stringify({ defaultBehavior: 'ask' }),
      { content: JSON.stringify({ defaultBehavior: 'pending' }) },
      GENERATED,
      '.junie/allowlist.json',
    );
    expect(JSON.parse(merged!).defaultBehavior).toBe('pending');
  });
});
