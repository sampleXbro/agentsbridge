import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hashPackFiles,
  INSTALL_MANIFEST_FILENAME,
} from '../../../../src/install/manifest/install-manifest-hash.js';
import * as hashMod from '../../../../src/utils/crypto/hash.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `install-manifest-hash-test-${Date.now()}-${Math.random()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('INSTALL_MANIFEST_FILENAME', () => {
  it('is the namespaced filename per plan', () => {
    expect(INSTALL_MANIFEST_FILENAME).toBe('.agentsmesh-install-manifest.json');
  });
});

describe('hashPackFiles', () => {
  it('returns a per-file map of sha256-prefixed hashes', async () => {
    mkdirSync(join(tmpDir, 'skills', 'demo'), { recursive: true });
    mkdirSync(join(tmpDir, 'rules'), { recursive: true });
    writeFileSync(join(tmpDir, 'skills', 'demo', 'SKILL.md'), '# demo\n');
    writeFileSync(join(tmpDir, 'rules', '_root.md'), '# root\n');

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result).sort()).toEqual(['rules/_root.md', 'skills/demo/SKILL.md']);
    for (const value of Object.values(result)) {
      expect(value).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it('uses forward-slash relative paths on all platforms', async () => {
    mkdirSync(join(tmpDir, 'skills', 'nested', 'inner'), { recursive: true });
    writeFileSync(join(tmpDir, 'skills', 'nested', 'inner', 'note.md'), 'note');

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result)).toEqual(['skills/nested/inner/note.md']);
  });

  it('excludes pack.yaml from the per-file map', async () => {
    writeFileSync(join(tmpDir, 'pack.yaml'), 'name: x\n');
    writeFileSync(join(tmpDir, 'kept.md'), 'kept');

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result)).toEqual(['kept.md']);
  });

  it('excludes the install-manifest filename itself', async () => {
    writeFileSync(join(tmpDir, INSTALL_MANIFEST_FILENAME), '{}');
    writeFileSync(join(tmpDir, 'kept.md'), 'kept');

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result)).toEqual(['kept.md']);
  });

  it('is deterministic for identical contents', async () => {
    mkdirSync(join(tmpDir, 'skills', 'a'), { recursive: true });
    writeFileSync(join(tmpDir, 'skills', 'a', 'SKILL.md'), 'fixed-content');

    const a = await hashPackFiles(tmpDir);
    const b = await hashPackFiles(tmpDir);

    expect(a).toEqual(b);
  });

  it('changes the hash when a file changes', async () => {
    writeFileSync(join(tmpDir, 'a.md'), 'one');
    const before = await hashPackFiles(tmpDir);

    writeFileSync(join(tmpDir, 'a.md'), 'two');
    const after = await hashPackFiles(tmpDir);

    expect(before['a.md']).not.toBe(after['a.md']);
  });

  it('returns an empty map for an empty pack directory', async () => {
    const result = await hashPackFiles(tmpDir);
    expect(result).toEqual({});
  });

  it('preserves insertion order sorted by relative path ascending', async () => {
    writeFileSync(join(tmpDir, 'b.md'), 'b');
    writeFileSync(join(tmpDir, 'a.md'), 'a');
    mkdirSync(join(tmpDir, 'skills', 'z'), { recursive: true });
    writeFileSync(join(tmpDir, 'skills', 'z', 'SKILL.md'), 'z');

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result)).toEqual(['a.md', 'b.md', 'skills/z/SKILL.md']);
  });

  it('treats CRLF and LF as identical for text extensions (M3 — drift normalization)', async () => {
    writeFileSync(join(tmpDir, 'lf.md'), 'line1\nline2\n');
    writeFileSync(join(tmpDir, 'crlf.md'), 'line1\r\nline2\r\n');

    const result = await hashPackFiles(tmpDir);

    // Markdown is text → normalized before hashing so a Windows editor saving
    // CRLF doesn't register as drift at uninstall time.
    expect(result['lf.md']).toBe(result['crlf.md']);
  });

  it('strips a leading UTF-8 BOM from text files before hashing (M3)', async () => {
    writeFileSync(join(tmpDir, 'plain.md'), 'line1\nline2\n');
    writeFileSync(join(tmpDir, 'with-bom.md'), '﻿line1\nline2\n');

    const result = await hashPackFiles(tmpDir);
    expect(result['plain.md']).toBe(result['with-bom.md']);
  });

  it('skips symlinked files entirely so install and uninstall agree (M4)', async () => {
    const { symlinkSync } = await import('node:fs');
    writeFileSync(join(tmpDir, 'real.md'), 'real\n');
    const outsideDir = mkdtempSync(join(tmpdir(), 'am-pack-hash-out-'));
    writeFileSync(join(outsideDir, 'outside.md'), 'outside\n');
    try {
      symlinkSync(join(outsideDir, 'outside.md'), join(tmpDir, 'linked.md'));
    } catch {
      // Symlinks unsupported on this filesystem (e.g. Windows without dev mode);
      // skip the contract assertion in that environment.
      return;
    }

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result).sort()).toEqual(['real.md']);
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('skips files where hashFileForManifest returns null (race against unlink)', async () => {
    writeFileSync(join(tmpDir, 'a.md'), 'alpha');
    writeFileSync(join(tmpDir, 'b.md'), 'beta');
    writeFileSync(join(tmpDir, 'c.md'), 'gamma');

    const real = hashMod.hashFileForManifest;
    vi.spyOn(hashMod, 'hashFileForManifest').mockImplementation(async (path: string) => {
      if (path.endsWith('b.md')) return null;
      return real(path);
    });

    const result = await hashPackFiles(tmpDir);
    expect(Object.keys(result).sort()).toEqual(['a.md', 'c.md']);
    vi.restoreAllMocks();
  });

  it('hashes binary supporting files by raw bytes (no UTF-8 round-trip)', async () => {
    mkdirSync(join(tmpDir, 'skills', 'demo', 'assets'), { recursive: true });
    const bytes = Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x01, 0x02, 0x80]);
    writeFileSync(join(tmpDir, 'skills', 'demo', 'assets', 'logo.png'), bytes);

    const result = await hashPackFiles(tmpDir);
    const expected = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    expect(result['skills/demo/assets/logo.png']).toBe(expected);
  });
});
