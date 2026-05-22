/**
 * Branch coverage for src/install/manual/collection-naming.ts:
 * - segments.length === 0 (file at sourceRoot)
 * - sanitizeNameSegment producing empty string (prefix === '' fallback)
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeNameSegment,
  computeDestName,
  namespacedName,
} from '../../../../src/install/manual/collection-naming.js';

describe('sanitizeNameSegment', () => {
  it('lowercases and replaces forbidden characters with hyphens', () => {
    expect(sanitizeNameSegment('Hello World!')).toBe('hello-world');
  });

  it('returns empty string when every char is forbidden', () => {
    expect(sanitizeNameSegment('!!!')).toBe('');
  });

  it('preserves dots in segment', () => {
    expect(sanitizeNameSegment('v1.2')).toBe('v1.2');
  });
});

describe('computeDestName', () => {
  it('rewrites .mdc → .md (case-insensitive)', () => {
    expect(computeDestName('/a/b/foo.MDC')).toBe('foo.md');
  });

  it('keeps .md unchanged', () => {
    expect(computeDestName('/a/b/foo.md')).toBe('foo.md');
  });

  it('keeps non-.mdc extensions intact', () => {
    expect(computeDestName('/a/b/foo.toml')).toBe('foo.toml');
  });
});

describe('namespacedName', () => {
  it('returns bareName when file sits directly inside sourceRoot (segments empty)', () => {
    expect(namespacedName('/root', '/root/foo.md', 'foo.md')).toBe('foo.md');
  });

  it('prepends sanitized parent directory name', () => {
    expect(namespacedName('/root', '/root/admin/build.md', 'build.md')).toBe('admin-build.md');
  });

  it('returns bareName when sanitized parent is empty (all-forbidden chars)', () => {
    // Parent segment is purely punctuation → sanitizes to '' → bareName fallback.
    expect(namespacedName('/root', '/root/!!!/build.md', 'build.md')).toBe('build.md');
  });

  it('handles Windows-style backslashes by normalizing to forward slashes', () => {
    expect(namespacedName('/root', '/root\\nested\\file.md', 'file.md')).toBe('nested-file.md');
  });
});
