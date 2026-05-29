import { describe, it, expect } from 'vitest';
import { redactUrlSecrets } from '../../../src/utils/output/redact-url-secrets.js';

describe('redactUrlSecrets', () => {
  it('redacts user:password from https URLs', () => {
    const input =
      'fatal: could not clone https://oauth2:ghp_secrettoken123@github.com/org/repo.git';
    const out = redactUrlSecrets(input);
    expect(out).not.toContain('ghp_secrettoken123');
    expect(out).not.toContain('oauth2:');
    expect(out).toContain('https://***@github.com/org/repo.git');
  });

  it('redacts x-access-token style URLs', () => {
    const input = 'failed: https://x-access-token:abc123@github.com/org/repo.git timed out';
    const out = redactUrlSecrets(input);
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('x-access-token');
    expect(out).toContain('https://***@github.com/org/repo.git');
  });

  it('redacts gitlab oauth2 URLs', () => {
    const input = 'remote: https://oauth2:glpat-xxxxxxxx@gitlab.com/ns/proj.git unavailable';
    const out = redactUrlSecrets(input);
    expect(out).not.toContain('glpat-xxxxxxxx');
  });

  it('leaves URLs without credentials unchanged', () => {
    const input = 'failed to fetch https://github.com/org/repo.git';
    expect(redactUrlSecrets(input)).toBe(input);
  });

  it('redacts multiple URLs in the same message', () => {
    const input = 'tried https://u1:p1@host.example/repo1 and https://u2:p2@host.example/repo2';
    const out = redactUrlSecrets(input);
    expect(out).not.toContain('p1');
    expect(out).not.toContain('p2');
    expect(out).not.toContain('u1:');
    expect(out).not.toContain('u2:');
    expect((out.match(/\*\*\*/g) ?? []).length).toBe(2);
  });

  it('redacts URLs with only a username (no password)', () => {
    const input = 'cloning https://gituser@host/repo.git';
    const out = redactUrlSecrets(input);
    expect(out).toContain('https://***@host/repo.git');
    expect(out).not.toContain('gituser@');
  });

  it('redacts ssh URLs with embedded credentials', () => {
    const input = 'cloning ssh://user:secret@host/repo.git';
    const out = redactUrlSecrets(input);
    expect(out).not.toContain('user:secret');
  });

  it('handles non-URL noise without altering it', () => {
    const input = 'Just an error message with no URL: ENOENT /tmp/foo';
    expect(redactUrlSecrets(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(redactUrlSecrets('')).toBe('');
  });

  it('preserves URLs ending in punctuation', () => {
    const input = 'failed: https://oauth2:tok@host/repo.git.';
    const out = redactUrlSecrets(input);
    expect(out).not.toContain('tok');
    expect(out).toContain('https://***@host/repo.git.');
  });
});
