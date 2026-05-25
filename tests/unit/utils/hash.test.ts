import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashContent, hashFile, hashFileForManifest } from '../../../src/utils/crypto/hash.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('hashContent', () => {
  it('returns consistent SHA-256 hex string', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different content = different hash', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('empty string has a hash', () => {
    expect(hashContent('')).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('hashFile', () => {
  const dir = join(tmpdir(), 'am-hash-test');

  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('hashes file content', async () => {
    writeFileSync(join(dir, 'test.txt'), 'hello');
    const h = await hashFile(join(dir, 'test.txt'));
    expect(h).toBe(hashContent('hello'));
  });

  it('returns null for non-existent file', async () => {
    expect(await hashFile(join(dir, 'nope.txt'))).toBeNull();
  });

  it('hashes binary bytes without UTF-8 lossy decoding', async () => {
    // Bytes that are not valid UTF-8. A buffered hash matches `createHash` on
    // the raw bytes; a `readFile(path, 'utf8')` round-trip replaces them with
    // U+FFFD and produces a different digest.
    const binPath = join(dir, 'bin');
    const bytes = Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x01, 0x02, 0x80]);
    writeFileSync(binPath, bytes);

    const hashed = await hashFile(binPath);
    const expected = createHash('sha256').update(bytes).digest('hex');
    expect(hashed).toBe(expected);
  });

  it('produces distinct hashes for CRLF vs LF line endings', async () => {
    const lfPath = join(dir, 'lf.txt');
    const crlfPath = join(dir, 'crlf.txt');
    writeFileSync(lfPath, 'line1\nline2\n');
    writeFileSync(crlfPath, 'line1\r\nline2\r\n');

    const lfHash = await hashFile(lfPath);
    const crlfHash = await hashFile(crlfPath);
    expect(lfHash).not.toBe(crlfHash);
  });
});

describe('hashFileForManifest', () => {
  const dir = join(tmpdir(), 'am-hash-manifest-test');

  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('treats CRLF-saved markdown as equal to LF-saved markdown', async () => {
    const lfPath = join(dir, 'lf.md');
    const crlfPath = join(dir, 'crlf.md');
    writeFileSync(lfPath, 'line1\nline2\n');
    writeFileSync(crlfPath, 'line1\r\nline2\r\n');

    const lfHash = await hashFileForManifest(lfPath);
    const crlfHash = await hashFileForManifest(crlfPath);
    expect(lfHash).toBe(lfHash); // sanity
    expect(crlfHash).toBe(lfHash);
  });

  it('strips a leading UTF-8 BOM for text extensions', async () => {
    const bomPath = join(dir, 'bom.md');
    const plainPath = join(dir, 'plain.md');
    writeFileSync(bomPath, '﻿line1\nline2\n');
    writeFileSync(plainPath, 'line1\nline2\n');

    expect(await hashFileForManifest(bomPath)).toBe(await hashFileForManifest(plainPath));
  });

  it('hashes binary extensions verbatim (no normalization)', async () => {
    const binPath = join(dir, 'image.png');
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    writeFileSync(binPath, bytes);

    const hashed = await hashFileForManifest(binPath);
    const expected = createHash('sha256').update(bytes).digest('hex');
    expect(hashed).toBe(expected);
  });

  it('returns null for a missing file', async () => {
    expect(await hashFileForManifest(join(dir, 'nope.md'))).toBeNull();
  });
});
