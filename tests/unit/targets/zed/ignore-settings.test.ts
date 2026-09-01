/**
 * Canonical ignore <-> Zed `file_scan_exclusions` / `private_files`.
 *
 * `file_scan_exclusions` is a SplicingVec (crates/settings_content/src/project.rs):
 * writing a bare array replaces the inherited layer, so the `"..."` marker must
 * be emitted to keep Zed's defaults. `private_files` is an ExtendingVec, which
 * appends, so it must NOT carry `"..."` (it would become a literal glob).
 */

import { describe, it, expect } from 'vitest';
import {
  ZED_SPLICE_REST,
  ignoreToZedGlob,
  zedGlobToIgnore,
  buildZedIgnoreSettings,
  parseZedIgnoreGlobs,
  unrepresentableIgnoreLines,
  mergeCanonicalIgnore,
  mergeZedIgnoreList,
} from '../../../../src/targets/zed/ignore-settings.js';

describe('ignoreToZedGlob', () => {
  it('makes a slash-free pattern depth-independent', () => {
    expect(ignoreToZedGlob('node_modules')).toBe('**/node_modules');
    expect(ignoreToZedGlob('*.log')).toBe('**/*.log');
  });

  it('drops a trailing directory slash', () => {
    expect(ignoreToZedGlob('node_modules/')).toBe('**/node_modules');
  });

  it('anchors a leading-slash pattern to the worktree root', () => {
    expect(ignoreToZedGlob('/dist')).toBe('dist');
  });

  it('keeps an embedded-slash pattern root-anchored, as gitignore does', () => {
    expect(ignoreToZedGlob('docs/build')).toBe('docs/build');
  });

  it('returns null for blanks, comments and negations', () => {
    expect(ignoreToZedGlob('')).toBeNull();
    expect(ignoreToZedGlob('   ')).toBeNull();
    expect(ignoreToZedGlob('# comment')).toBeNull();
    expect(ignoreToZedGlob('!keep.log')).toBeNull();
    expect(ignoreToZedGlob('/')).toBeNull();
  });
});

describe('zedGlobToIgnore', () => {
  it('round-trips the depth-independent form', () => {
    expect(zedGlobToIgnore('**/node_modules')).toBe('node_modules');
    expect(zedGlobToIgnore('**/*.log')).toBe('*.log');
  });

  it('re-anchors a root-relative glob with a leading slash', () => {
    expect(zedGlobToIgnore('dist')).toBe('/dist');
    expect(zedGlobToIgnore('docs/build')).toBe('/docs/build');
  });

  it('keeps a deep `**/` glob root-anchored', () => {
    expect(zedGlobToIgnore('**/a/b')).toBe('/**/a/b');
  });

  it('ignores the splice marker and blanks', () => {
    expect(zedGlobToIgnore(ZED_SPLICE_REST)).toBeNull();
    expect(zedGlobToIgnore('  ')).toBeNull();
  });
});

describe('buildZedIgnoreSettings', () => {
  it('splices Zed defaults back into file_scan_exclusions but not private_files', () => {
    const settings = buildZedIgnoreSettings(['node_modules/', '/dist', '*.log']);
    expect(settings.file_scan_exclusions).toEqual([
      '**/node_modules',
      'dist',
      '**/*.log',
      ZED_SPLICE_REST,
    ]);
    expect(settings.private_files).toEqual(['**/node_modules', 'dist', '**/*.log']);
  });

  it('writes nothing at all when canonical has no representable line', () => {
    expect(buildZedIgnoreSettings([])).toEqual({ file_scan_exclusions: [], private_files: [] });
    expect(buildZedIgnoreSettings(['# only a comment', '!keep.log'])).toEqual({
      file_scan_exclusions: [],
      private_files: [],
    });
  });

  it('skips comments and negations and de-duplicates', () => {
    const settings = buildZedIgnoreSettings(['# secrets', '!keep.log', 'dist/', 'dist']);
    expect(settings.file_scan_exclusions).toEqual(['**/dist', ZED_SPLICE_REST]);
  });
});

describe('parseZedIgnoreGlobs', () => {
  it('unions both keys, first-seen order, without the splice marker', () => {
    expect(
      parseZedIgnoreGlobs({
        file_scan_exclusions: ['**/node_modules', ZED_SPLICE_REST],
        private_files: ['**/.env*', '**/node_modules'],
      }),
    ).toEqual(['**/node_modules', '**/.env*']);
  });

  it('returns [] when neither key is an array of strings', () => {
    expect(parseZedIgnoreGlobs({})).toEqual([]);
    expect(parseZedIgnoreGlobs({ file_scan_exclusions: 'nope', private_files: 7 })).toEqual([]);
    expect(parseZedIgnoreGlobs({ file_scan_exclusions: [1, 2] })).toEqual([]);
  });
});

describe('unrepresentableIgnoreLines', () => {
  it('names negations, which Zed globs cannot express', () => {
    expect(unrepresentableIgnoreLines(['dist/', '!dist/keep.txt', '# note', ''])).toEqual([
      '!dist/keep.txt',
    ]);
  });
});

describe('mergeCanonicalIgnore', () => {
  it('writes the imported globs when canonical is absent', () => {
    expect(mergeCanonicalIgnore(null, ['**/node_modules', 'dist'])).toBe('node_modules\n/dist');
  });

  it('keeps comments and negations Zed cannot represent', () => {
    const existing = '# build output\ndist/\n!dist/keep.txt\n';
    expect(mergeCanonicalIgnore(existing, ['**/dist'])).toBe(
      '# build output\ndist/\n!dist/keep.txt\n',
    );
  });

  it('keeps a canonical line Zed does not list — every target reads this file', () => {
    const existing = '# keep\ndist/\n*.log\n';
    expect(mergeCanonicalIgnore(existing, ['**/dist'])).toBe('# keep\ndist/\n*.log\n');
  });

  it('appends globs the canonical file does not have yet', () => {
    expect(mergeCanonicalIgnore('dist/\n', ['**/dist', '**/*.log'])).toBe('dist/\n*.log\n');
  });

  it('treats an empty canonical file as absent', () => {
    expect(mergeCanonicalIgnore('   \n', ['**/dist'])).toBe('dist');
  });
});

describe('mergeZedIgnoreList', () => {
  it('keeps the exclusions the user hand-wrote and appends the canonical ones', () => {
    expect(mergeZedIgnoreList(['**/target', '**/.venv'], ['**/dist'])).toEqual([
      '**/target',
      '**/.venv',
      '**/dist',
    ]);
  });

  it('writes the splice marker last when the key is new', () => {
    expect(mergeZedIgnoreList(undefined, ['**/dist', ZED_SPLICE_REST])).toEqual([
      '**/dist',
      ZED_SPLICE_REST,
    ]);
  });

  it('keeps a bare user array bare — they replaced Zed defaults on purpose', () => {
    expect(mergeZedIgnoreList(['**/target'], ['**/dist', ZED_SPLICE_REST])).toEqual([
      '**/target',
      '**/dist',
    ]);
  });

  it('keeps the splice marker last when the user already had one', () => {
    expect(
      mergeZedIgnoreList(['**/target', ZED_SPLICE_REST], ['**/dist', ZED_SPLICE_REST]),
    ).toEqual(['**/target', '**/dist', ZED_SPLICE_REST]);
  });

  it('is idempotent: merging its own output changes nothing', () => {
    const desired = ['**/dist', ZED_SPLICE_REST];
    const once = mergeZedIgnoreList(undefined, desired)!;
    expect(mergeZedIgnoreList(once, desired)).toEqual(once);
  });

  it('returns null when canonical has nothing to add, leaving the key untouched', () => {
    expect(mergeZedIgnoreList(['**/target'], [])).toBeNull();
    expect(mergeZedIgnoreList(undefined, [ZED_SPLICE_REST])).toBeNull();
  });
});
