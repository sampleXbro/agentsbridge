import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanInstallCache,
  cacheKeyFromSource,
  sweepStaleCache,
} from '../../../src/install/cache-cleanup.js';

let cacheDir: string;

beforeEach(() => {
  cacheDir = join(tmpdir(), `cache-cleanup-test-${Date.now()}`);
  mkdirSync(cacheDir, { recursive: true });
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('cacheKeyFromSource', () => {
  it('builds github cache key from source string', () => {
    const key = cacheKeyFromSource('github:org/repo@abc123');
    expect(key).toBe('org-repo-abc123');
  });

  it('builds gitlab cache key from source string', () => {
    const key = cacheKeyFromSource('gitlab:ns/project@abc123');
    expect(key).toBe('gitlab_ns_project_abc123');
  });

  it('builds git cache key from source string', () => {
    const key = cacheKeyFromSource('git+https://example.com/org/repo.git#abc123');
    // provider=git, identifier=url, ref=abc123
    expect(key).toMatch(/^git_/);
    expect(key).toContain('abc123');
  });

  it('returns null for local (non-remote) source', () => {
    expect(cacheKeyFromSource('../local/path')).toBeNull();
  });

  it('returns null for invalid source', () => {
    expect(cacheKeyFromSource('not-a-valid-source')).toBeNull();
  });
});

describe('sweepStaleCache', () => {
  function makeEntry(name: string, ageMs: number): string {
    const entryPath = join(cacheDir, name);
    mkdirSync(entryPath, { recursive: true });
    const mtime = new Date(Date.now() - ageMs);
    utimesSync(entryPath, mtime, mtime);
    return entryPath;
  }

  const DAY = 86_400_000;

  it('removes entries older than maxAgeMs', async () => {
    const old = makeEntry('old-entry', 31 * DAY);
    const fresh = makeEntry('fresh-entry', 1 * DAY);

    await sweepStaleCache(cacheDir, 30 * DAY);

    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('keeps entries exactly at the boundary (not strictly older)', async () => {
    // entry is exactly at maxAgeMs — should be kept (age < threshold requires strictly greater)
    const boundary = makeEntry('boundary-entry', 30 * DAY - 1000);

    await sweepStaleCache(cacheDir, 30 * DAY);

    expect(existsSync(boundary)).toBe(true);
  });

  it('removes multiple stale entries in one pass', async () => {
    const stale1 = makeEntry('stale-a', 60 * DAY);
    const stale2 = makeEntry('stale-b', 45 * DAY);
    const fresh = makeEntry('fresh-c', 5 * DAY);

    await sweepStaleCache(cacheDir, 30 * DAY);

    expect(existsSync(stale1)).toBe(false);
    expect(existsSync(stale2)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('is a no-op when cache dir does not exist', async () => {
    const nonexistent = join(tmpdir(), `no-such-cache-${Date.now()}`);
    await expect(sweepStaleCache(nonexistent, 30 * DAY)).resolves.not.toThrow();
  });

  it('is a no-op when cache dir is empty', async () => {
    await expect(sweepStaleCache(cacheDir, 30 * DAY)).resolves.not.toThrow();
  });

  it('keeps all entries when none exceed the threshold', async () => {
    const a = makeEntry('recent-a', 1 * DAY);
    const b = makeEntry('recent-b', 2 * DAY);

    await sweepStaleCache(cacheDir, 30 * DAY);

    expect(existsSync(a)).toBe(true);
    expect(existsSync(b)).toBe(true);
  });

  it('reads maxAgeMs from AGENTSBRIDGE_CACHE_MAX_AGE_DAYS env var when not provided', async () => {
    const old = makeEntry('env-stale', 8 * DAY);
    const fresh = makeEntry('env-fresh', 2 * DAY);

    const prev = process.env.AGENTSBRIDGE_CACHE_MAX_AGE_DAYS;
    process.env.AGENTSBRIDGE_CACHE_MAX_AGE_DAYS = '7';
    try {
      await sweepStaleCache(cacheDir);
    } finally {
      if (prev === undefined) delete process.env.AGENTSBRIDGE_CACHE_MAX_AGE_DAYS;
      else process.env.AGENTSBRIDGE_CACHE_MAX_AGE_DAYS = prev;
    }

    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });
});

describe('cleanInstallCache', () => {
  it('removes the cache entry directory', async () => {
    const entryDir = join(cacheDir, 'org-repo-abc123');
    mkdirSync(entryDir, { recursive: true });
    expect(existsSync(entryDir)).toBe(true);

    await cleanInstallCache('github:org/repo@abc123', cacheDir);
    expect(existsSync(entryDir)).toBe(false);
  });

  it('does not throw when cache entry does not exist', async () => {
    await expect(cleanInstallCache('github:org/repo@abc123', cacheDir)).resolves.not.toThrow();
  });

  it('does not throw for local source (no-op)', async () => {
    await expect(cleanInstallCache('../local/path', cacheDir)).resolves.not.toThrow();
  });
});
