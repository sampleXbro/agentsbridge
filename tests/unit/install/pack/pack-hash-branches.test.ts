/**
 * Branch coverage for src/install/pack/pack-hash.ts line 22-23:
 * - hashFile returns null (broken symlink / unreadable file) is excluded from fingerprint.
 * - pack.yaml is excluded from the fingerprint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashPackContent } from '../../../../src/install/pack/pack-hash.js';

let packDir = '';

beforeEach(() => {
  packDir = mkdtempSync(join(tmpdir(), 'am-pack-hash-'));
});

afterEach(() => {
  rmSync(packDir, { recursive: true, force: true });
});

describe('hashPackContent — branch coverage', () => {
  it('returns a stable sha256 hash with sha256: prefix', async () => {
    writeFileSync(join(packDir, 'a.md'), 'one');
    writeFileSync(join(packDir, 'b.md'), 'two');
    const h = await hashPackContent(packDir);
    expect(h.startsWith('sha256:')).toBe(true);
    // Re-running on identical contents yields the same hash.
    expect(await hashPackContent(packDir)).toBe(h);
  });

  it('excludes pack.yaml from the fingerprint', async () => {
    writeFileSync(join(packDir, 'a.md'), 'one');
    const without = await hashPackContent(packDir);
    writeFileSync(join(packDir, 'pack.yaml'), 'name: test\n');
    const withPackYaml = await hashPackContent(packDir);
    expect(without).toBe(withPackYaml);
  });

  it('skips broken symlinks (hashFile returns null branch)', async () => {
    writeFileSync(join(packDir, 'a.md'), 'one');
    try {
      symlinkSync(join(packDir, 'no-target'), join(packDir, 'dangling.md'));
    } catch {
      return; // platforms without symlinks
    }
    // Should not throw even though dangling.md cannot be read.
    const h = await hashPackContent(packDir);
    expect(h.startsWith('sha256:')).toBe(true);
  });

  it('produces an empty-fingerprint hash for a pack with only pack.yaml', async () => {
    writeFileSync(join(packDir, 'pack.yaml'), 'name: empty\n');
    const h = await hashPackContent(packDir);
    expect(h.startsWith('sha256:')).toBe(true);
  });
});
