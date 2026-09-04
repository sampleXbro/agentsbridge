import { describe, it, expect } from 'vitest';
import {
  mapIgnoreToOpenCodePermission,
  mapOpenCodePermissionToIgnore,
} from '../../../../src/targets/opencode/ignore-map.js';

describe('mapIgnoreToOpenCodePermission', () => {
  it('returns {} for an empty ignore list', () => {
    expect(mapIgnoreToOpenCodePermission([])).toEqual({});
  });

  it('maps a bare filename to a depth-independent read+edit deny rule', () => {
    expect(mapIgnoreToOpenCodePermission(['.env'])).toEqual({
      read: { '*.env': 'deny' },
      edit: { '*.env': 'deny' },
    });
  });

  it('expands a trailing-slash directory pattern to cover its contents', () => {
    expect(mapIgnoreToOpenCodePermission(['node_modules/']).read).toEqual({
      '*node_modules/*': 'deny',
    });
  });

  it('drops the root anchor from a leading-slash pattern', () => {
    expect(mapIgnoreToOpenCodePermission(['/dist']).read).toEqual({ '*dist': 'deny' });
  });

  it('still prefixes a wildcard pattern so the rule round-trips', () => {
    expect(mapIgnoreToOpenCodePermission(['*.log']).read).toEqual({ '**.log': 'deny' });
  });

  it('maps a gitignore negation to an allow rule placed after the deny (last match wins)', () => {
    const rules = mapIgnoreToOpenCodePermission(['secrets/**', '!secrets/public.md']).read;
    expect(rules).toEqual({ '*secrets/**': 'deny', '*secrets/public.md': 'allow' });
    expect(Object.keys(rules!)).toEqual(['*secrets/**', '*secrets/public.md']);
  });

  it('skips comments, blank lines and patterns that would become a bare "*" deny-all', () => {
    expect(mapIgnoreToOpenCodePermission(['# comment', '   ', '!', '/'])).toEqual({});
  });

  it('gives read and edit independent rule objects', () => {
    const mapped = mapIgnoreToOpenCodePermission(['.env']);
    expect(mapped.read).not.toBe(mapped.edit);
  });
});

describe('mapOpenCodePermissionToIgnore', () => {
  it('returns [] for non-object input', () => {
    expect(mapOpenCodePermissionToIgnore(null)).toEqual([]);
    expect(mapOpenCodePermissionToIgnore('allow')).toEqual([]);
    expect(mapOpenCodePermissionToIgnore(['read'])).toEqual([]);
  });

  it('returns [] when read/edit use the non-granular string form', () => {
    expect(mapOpenCodePermissionToIgnore({ read: 'allow', edit: 'deny' })).toEqual([]);
  });

  it('recovers ignore patterns from read deny rules', () => {
    expect(mapOpenCodePermissionToIgnore({ read: { '*.env': 'deny' } })).toEqual(['.env']);
  });

  it('ignores the "*" catch-all rule and "ask" rules', () => {
    expect(
      mapOpenCodePermissionToIgnore({
        read: { '*': 'allow', '*build/*': 'deny', '*maybe.md': 'ask' },
      }),
    ).toEqual(['build/*']);
  });

  it('restores the "!" prefix for allow rules', () => {
    expect(
      mapOpenCodePermissionToIgnore({ read: { '*secrets/*': 'deny', '*secrets/ok.md': 'allow' } }),
    ).toEqual(['secrets/*', '!secrets/ok.md']);
  });

  it('merges edit-only rules after read rules without duplicates', () => {
    expect(
      mapOpenCodePermissionToIgnore({
        read: { '*a.txt': 'deny' },
        edit: { '*a.txt': 'deny', '*b.txt': 'deny' },
      }),
    ).toEqual(['a.txt', 'b.txt']);
  });

  it('ignores permission keys that do not match a file path (bash, grep, glob)', () => {
    expect(
      mapOpenCodePermissionToIgnore({
        bash: { 'rm *': 'deny' },
        grep: { '*secret*': 'deny' },
        glob: { '*.env': 'deny' },
      }),
    ).toEqual([]);
  });
});

describe('opencode ignore round-trip', () => {
  it('generate -> import returns the exact canonical patterns', () => {
    const patterns = ['.env', 'node_modules/*', '*.log', '!keep/allowed.md'];
    const mapped = mapIgnoreToOpenCodePermission(patterns);
    expect(mapOpenCodePermissionToIgnore(mapped)).toEqual(patterns);
  });

  it('normalises a trailing-slash directory pattern and is stable on the next pass', () => {
    const first = mapOpenCodePermissionToIgnore(mapIgnoreToOpenCodePermission(['node_modules/']));
    expect(first).toEqual(['node_modules/*']);
    expect(mapOpenCodePermissionToIgnore(mapIgnoreToOpenCodePermission(first))).toEqual(first);
  });
});
