/**
 * Branch coverage for helper functions in
 * `src/targets/import/import-metadata-core.ts`. Covers:
 *   - toStringArray: array of strings, mixed array, comma-separated string,
 *     non-array/string returns []
 *   - readString: returns string or undefined
 *   - readHooks: returns object or undefined (not for null/array/non-object)
 *   - readExistingFrontmatter: missing file returns {}
 *   - serializeImportedRuleWithFallback: root vs non-root paths
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readExistingFrontmatter,
  readHooks,
  readString,
  serializeImportedRuleWithFallback,
  toStringArray,
} from '../../../../src/targets/import/import-metadata-core.js';

describe('toStringArray', () => {
  it('passes through an array of strings (trimmed, dropping empties)', () => {
    expect(toStringArray(['  a ', 'b', ''])).toEqual(['a', 'b']);
  });

  it('filters out non-string entries from a mixed array', () => {
    expect(toStringArray(['a', 1, null, 'b'])).toEqual(['a', 'b']);
  });

  it('splits comma-separated strings (trim + drop empties)', () => {
    expect(toStringArray(' a , b , ')).toEqual(['a', 'b']);
  });

  it('returns [] for non-array/non-string values', () => {
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray(undefined)).toEqual([]);
    expect(toStringArray({ a: 1 })).toEqual([]);
    expect(toStringArray(42)).toEqual([]);
  });
});

describe('readString', () => {
  it('returns the string value when present', () => {
    expect(readString({ a: 'hello' }, 'a')).toBe('hello');
  });

  it('returns undefined when the key is missing or a non-string', () => {
    expect(readString({}, 'a')).toBeUndefined();
    expect(readString({ a: 1 }, 'a')).toBeUndefined();
    expect(readString({ a: null }, 'a')).toBeUndefined();
  });
});

describe('readHooks', () => {
  it('returns the hooks record for plain object input', () => {
    expect(readHooks({ hooks: { PreToolUse: [] } })).toEqual({ PreToolUse: [] });
  });

  it('returns undefined when hooks is missing, an array, or a primitive', () => {
    expect(readHooks({})).toBeUndefined();
    expect(readHooks({ hooks: null })).toBeUndefined();
    expect(readHooks({ hooks: [1, 2] })).toBeUndefined();
    expect(readHooks({ hooks: 'no' })).toBeUndefined();
  });
});

describe('readExistingFrontmatter', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'imdc-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns {} when file does not exist', async () => {
    expect(await readExistingFrontmatter(join(dir, 'nope.md'))).toEqual({});
  });

  it('returns parsed frontmatter for an existing markdown file', async () => {
    const file = join(dir, 'x.md');
    await writeFile(file, '---\nname: a\n---\nbody', 'utf8');
    expect(await readExistingFrontmatter(file)).toMatchObject({ name: 'a' });
  });
});

describe('serializeImportedRuleWithFallback', () => {
  it('sets root: true and omits globs when destination basename is "_root.md"', async () => {
    const out = await serializeImportedRuleWithFallback(
      '/tmp/_root.md',
      { description: 'rd' },
      'body',
    );
    expect(out).toContain('root: true');
    expect(out).toContain('description: rd');
    expect(out).not.toContain('globs:');
  });

  it('sets root: false and includes globs (defaulted to []) for non-root rules', async () => {
    const out = await serializeImportedRuleWithFallback(
      '/tmp/other.md',
      { description: 'd', globs: ['src/**'] },
      'body',
    );
    expect(out).toContain('root: false');
    expect(out).toMatch(/globs:\s*\n\s+- src\/\*\*/);
  });
});
