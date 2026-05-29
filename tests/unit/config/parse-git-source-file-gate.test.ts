import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseGitSource } from '../../../src/config/remote/remote-source.js';

/**
 * Security regression: `git+file://` sources are a local-FS trust boundary.
 * On shared/multi-tenant hosts a `git+file:///tmp/world-writable-repo`
 * `extends:` clause could silently consume a repo planted by another user.
 * Combined with downstream hook/permission/mcp emission this becomes a
 * local-priv-esc vector. Gate them behind explicit env opt-in so the default
 * install can never pick up a local-FS repo silently.
 */
describe('parseGitSource — file:// gate', () => {
  const ORIGINAL = process.env.AGENTSMESH_ALLOW_LOCAL_GIT;

  beforeEach(() => {
    delete process.env.AGENTSMESH_ALLOW_LOCAL_GIT;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.AGENTSMESH_ALLOW_LOCAL_GIT;
    } else {
      process.env.AGENTSMESH_ALLOW_LOCAL_GIT = ORIGINAL;
    }
  });

  it('rejects file:// by default', () => {
    expect(parseGitSource('git+file:///tmp/r')).toBeNull();
  });

  it('rejects file:// even when AGENTSMESH_ALLOW_INSECURE_GIT=1 (different gate)', () => {
    process.env.AGENTSMESH_ALLOW_INSECURE_GIT = '1';
    try {
      expect(parseGitSource('git+file:///tmp/r')).toBeNull();
    } finally {
      delete process.env.AGENTSMESH_ALLOW_INSECURE_GIT;
    }
  });

  it('accepts file:// when AGENTSMESH_ALLOW_LOCAL_GIT=1', () => {
    process.env.AGENTSMESH_ALLOW_LOCAL_GIT = '1';
    expect(parseGitSource('git+file:///tmp/r')).toEqual({
      url: 'file:///tmp/r',
      ref: undefined,
    });
  });

  it('accepts file:// when AGENTSMESH_ALLOW_LOCAL_GIT=true', () => {
    process.env.AGENTSMESH_ALLOW_LOCAL_GIT = 'true';
    expect(parseGitSource('git+file:///tmp/r')).not.toBeNull();
  });

  it('https:// is unaffected by the local-git gate', () => {
    expect(parseGitSource('git+https://github.com/o/r.git')).not.toBeNull();
  });

  it('ssh:// is unaffected by the local-git gate', () => {
    expect(parseGitSource('git+ssh://git@host/r.git')).not.toBeNull();
  });
});
