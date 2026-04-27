import { describe, expect, it } from 'vitest';
import {
  normalizeInstallPathField,
  normalizeLocalSourceForYaml,
  normalizePersistedInstallPaths,
  pathApiFor,
  toPosixPath,
} from '../../../src/install/core/portable-paths.js';

describe('portable-paths', () => {
  describe('pathApiFor', () => {
    it('selects win32 when any input contains a backslash', () => {
      const api = pathApiFor('C:\\proj', './sub');
      expect(api.sep).toBe('\\');
    });

    it('selects win32 for drive-letter inputs without backslashes', () => {
      const api = pathApiFor('C:/proj/sub');
      expect(api.sep).toBe('\\');
    });

    it('selects posix when all inputs are POSIX-shaped', () => {
      const api = pathApiFor('/proj', './sub', '../other');
      expect(api.sep).toBe('/');
    });
  });

  describe('toPosixPath', () => {
    it('replaces backslashes with forward slashes', () => {
      expect(toPosixPath('a\\b\\c')).toBe('a/b/c');
    });

    it('leaves POSIX paths unchanged', () => {
      expect(toPosixPath('a/b/c')).toBe('a/b/c');
    });
  });

  describe('normalizeInstallPathField', () => {
    it('strips leading and trailing slashes after posix conversion', () => {
      expect(normalizeInstallPathField('/foo/bar/')).toBe('foo/bar');
      expect(normalizeInstallPathField('\\foo\\bar\\')).toBe('foo/bar');
    });

    it('returns empty string for slash-only inputs', () => {
      expect(normalizeInstallPathField('//')).toBe('');
    });
  });

  describe('normalizeLocalSourceForYaml', () => {
    it('returns "." for empty, ".", or "./." inputs', () => {
      expect(normalizeLocalSourceForYaml('')).toBe('.');
      expect(normalizeLocalSourceForYaml('.')).toBe('.');
      expect(normalizeLocalSourceForYaml('./.')).toBe('.');
    });

    it('preserves "./", "../", "/" prefixes', () => {
      expect(normalizeLocalSourceForYaml('./pack')).toBe('./pack');
      expect(normalizeLocalSourceForYaml('../shared')).toBe('../shared');
      expect(normalizeLocalSourceForYaml('/abs/pack')).toBe('/abs/pack');
    });

    it('preserves Windows POSIX-form absolute paths (`C:/...`)', () => {
      expect(normalizeLocalSourceForYaml('C:/Users/me/pack')).toBe('C:/Users/me/pack');
      // Backslashes are converted to forward slashes first.
      expect(normalizeLocalSourceForYaml('C:\\Users\\me\\pack')).toBe('C:/Users/me/pack');
    });

    it('prepends "./" for bare relative paths (covers the unflagged branch)', () => {
      // Critical: this branch was uncovered before — bare paths like `mypack`
      // must round-trip with an explicit `./` so YAML readers treat them as
      // local relative sources.
      expect(normalizeLocalSourceForYaml('mypack')).toBe('./mypack');
      expect(normalizeLocalSourceForYaml('packs/foo')).toBe('./packs/foo');
      expect(normalizeLocalSourceForYaml('packs\\foo')).toBe('./packs/foo');
    });
  });

  describe('normalizePersistedInstallPaths', () => {
    it('normalizes local source and bare path field', () => {
      const result = normalizePersistedInstallPaths({
        source: 'mypack',
        source_kind: 'local',
        path: '/skills/foo/',
      });
      expect(result.source).toBe('./mypack');
      expect(result.path).toBe('skills/foo');
    });

    it('leaves source alone when source_kind is not local', () => {
      const result = normalizePersistedInstallPaths({
        source: 'github:owner/repo',
        source_kind: 'git',
      });
      expect(result.source).toBe('github:owner/repo');
    });

    it('normalizes each entry in the paths array', () => {
      const result = normalizePersistedInstallPaths({
        source: '.',
        source_kind: 'local',
        paths: ['\\skills\\a\\', '/skills/b'],
      });
      expect(result.paths).toEqual(['skills/a', 'skills/b']);
    });

    it('omits path/paths fields when input has neither', () => {
      const result = normalizePersistedInstallPaths({
        source: '.',
        source_kind: 'local',
      });
      expect('path' in result).toBe(false);
      expect('paths' in result).toBe(false);
    });
  });
});
