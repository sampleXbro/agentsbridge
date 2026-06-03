import { describe, it, expect } from 'vitest';
import { hashBullet } from '../../../src/lessons/bullet-hash.js';

describe('hashBullet', () => {
  it('returns a stable 16-char hex hash for the same bullet text', () => {
    const h = hashBullet('- **Foo bar**: baz');
    expect(h).toBe(hashBullet('- **Foo bar**: baz'));
    expect(h).toMatch(/^[a-f0-9]{16}$/);
  });

  it('ignores trailing whitespace and trailing newlines', () => {
    expect(hashBullet('- foo  \n')).toBe(hashBullet('- foo'));
  });

  it('strips a leading list marker so " - foo" matches "- foo" matches "* foo"', () => {
    expect(hashBullet(' - foo')).toBe(hashBullet('- foo'));
    expect(hashBullet('* foo')).toBe(hashBullet('- foo'));
  });

  it('treats different bullets as different hashes', () => {
    expect(hashBullet('- foo')).not.toBe(hashBullet('- bar'));
  });
});
