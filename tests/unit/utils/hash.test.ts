import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashContent, hashFile } from '../../../src/utils/crypto/hash.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
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
});
