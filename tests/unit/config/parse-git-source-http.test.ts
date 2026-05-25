/**
 * Security: `git+http://` strips transport security. A MITM on any hop
 * between the agentsmesh runtime and the remote can swap the cloned bytes
 * before SHA pinning resolves. Reject by default; allow via an explicit
 * env opt-in for closed-network development.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { parseGitSource } from '../../../src/config/remote/remote-source.js';

const ENV_KEY = 'AGENTSMESH_ALLOW_INSECURE_GIT';

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('parseGitSource — http allowlist', () => {
  it('rejects git+http:// by default', () => {
    expect(parseGitSource('git+http://example.com/repo.git#main')).toBeNull();
  });

  it('accepts git+http:// when AGENTSMESH_ALLOW_INSECURE_GIT=1', () => {
    process.env[ENV_KEY] = '1';
    expect(parseGitSource('git+http://example.com/repo.git#main')).toEqual({
      url: 'http://example.com/repo.git',
      ref: 'main',
    });
  });

  it('always accepts git+https://', () => {
    expect(parseGitSource('git+https://example.com/repo.git#main')).toEqual({
      url: 'https://example.com/repo.git',
      ref: 'main',
    });
  });
});
