/**
 * Security: copyDir must not dereference symlinks. A symlink in the source
 * tree pointing outside the source root would otherwise have its TARGET
 * bytes copied into the destination, allowing content exfiltration into
 * redistributed packs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyDir } from '../../../src/utils/filesystem/fs.js';

let workDir = '';

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'am-copydir-symlink-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('copyDir — symlink hardening', () => {
  it('does not dereference a file symlink pointing outside the source', async () => {
    const src = join(workDir, 'src');
    const dest = join(workDir, 'dest');
    const outside = join(workDir, 'secret');
    mkdirSync(src);
    mkdirSync(outside);
    writeFileSync(join(outside, 'secret.txt'), 'SECRET');
    writeFileSync(join(src, 'real.txt'), 'real');
    try {
      symlinkSync(join(outside, 'secret.txt'), join(src, 'link.txt'));
    } catch {
      return; // platforms without symlinks
    }

    await copyDir(src, dest);

    // Real file gets copied.
    expect(existsSync(join(dest, 'real.txt'))).toBe(true);
    // Symlink target bytes are NOT exfiltrated into the destination.
    expect(existsSync(join(dest, 'link.txt'))).toBe(false);
  });

  it('does not descend into a directory symlink pointing outside the source', async () => {
    const src = join(workDir, 'src');
    const dest = join(workDir, 'dest');
    const outside = join(workDir, 'foreign');
    mkdirSync(src);
    mkdirSync(outside);
    writeFileSync(join(outside, 'foreign.txt'), 'FOREIGN');
    writeFileSync(join(src, 'kept.txt'), 'kept');
    try {
      symlinkSync(outside, join(src, 'linked-dir'), 'dir');
    } catch {
      return;
    }

    await copyDir(src, dest);

    expect(existsSync(join(dest, 'kept.txt'))).toBe(true);
    // The linked directory's contents must not appear under dest.
    expect(existsSync(join(dest, 'linked-dir', 'foreign.txt'))).toBe(false);
    expect(existsSync(join(dest, 'linked-dir'))).toBe(false);
  });
});
