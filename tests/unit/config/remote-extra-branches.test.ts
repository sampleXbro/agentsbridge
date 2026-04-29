import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  fetchGithubRemoteExtend,
  resolveLatestTag,
} from '../../../src/config/remote/github-remote.js';
import { parseGitlabSource } from '../../../src/config/remote/remote-source.js';

const mockFetchGitRemoteExtend = vi.hoisted(() => vi.fn());
const mockTarExtract = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../../src/config/remote/git-remote.js', () => ({
  fetchGitRemoteExtend: mockFetchGitRemoteExtend,
}));
vi.mock('tar', () => ({ extract: mockTarExtract }));

function buildCacheKey(provider: string, identifier: string, ref: string): string {
  const safe = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe(provider)}__${safe(identifier)}__${safe(ref)}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('parseGitlabSource branch — namespace/project empty', () => {
  it('returns null when namespace empty (slug starts with /)', () => {
    expect(parseGitlabSource('gitlab:/proj@v1')).toBeNull();
  });
});

describe('github-remote — extra branches', () => {
  it('throws non-OK from resolveLatestTag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
    );
    await expect(resolveLatestTag('o', 'r')).rejects.toThrow(/404 Not Found/);
  });

  it('passes tarball fetch and falls through cache when topDir not single', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-rem-extra-'));
    try {
      const cacheKey = buildCacheKey('github', 'o/r', 'v1');
      const extractDir = join(cacheDir, cacheKey);
      // Create TWO non-dot dirs so findExtractTopDir returns null
      mkdirSync(join(extractDir, 'first'), { recursive: true });
      mkdirSync(join(extractDir, 'second'), { recursive: true });

      // Network success: refresh = false but topDir resolution fails → goes to fetch+extract
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(0),
          status: 200,
          statusText: 'OK',
        }),
      );
      mockTarExtract.mockImplementationOnce(async ({ cwd }: { cwd: string }) => {
        mkdirSync(join(cwd, 'extracted-top'), { recursive: true });
      });
      const result = await fetchGithubRemoteExtend(
        { org: 'o', repo: 'r', tag: 'v1' },
        'ext',
        { refresh: false },
        cacheDir,
        buildCacheKey,
        false,
      );
      expect(result.resolvedPath).toContain('extracted-top');
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('throws when fetch returns non-OK response (line 65)', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-rem-nok-'));
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        }),
      );
      await expect(
        fetchGithubRemoteExtend(
          { org: 'o', repo: 'r', tag: 'v9' },
          'ext',
          { allowOfflineFallback: false },
          cacheDir,
          buildCacheKey,
          false,
        ),
      ).rejects.toThrow(/HTTP 503/);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('falls back through cached path but topDir missing (line 71 false)', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-rem-topdirfail-'));
    try {
      const cacheKey = buildCacheKey('github', 'o/r', 'v3');
      const extractDir = join(cacheDir, cacheKey);
      // Two dirs in cache → topDir() returns null even though cache "exists"
      mkdirSync(join(extractDir, 'a'), { recursive: true });
      mkdirSync(join(extractDir, 'b'), { recursive: true });

      let calls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          calls++;
          throw new Error('network down');
        }),
      );
      mockTarExtract.mockImplementationOnce(async () => {
        // Don't create top-level dir — extraction succeeds but findExtractTopDir() fails
      });
      // refresh=true forces network fetch attempt; cache has multiple dirs so fallback also fails
      await expect(
        fetchGithubRemoteExtend(
          { org: 'o', repo: 'r', tag: 'v3' },
          'ext',
          { refresh: true, allowOfflineFallback: true },
          cacheDir,
          buildCacheKey,
          false,
        ),
      ).rejects.toThrow();
      expect(calls).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('rethrows non-Error thrown values during network failure (line 73 String(err))', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-rem-strerr-'));
    try {
      const cacheKey = buildCacheKey('github', 'o/r', 'v4');
      const extractDir = join(cacheDir, cacheKey);
      mkdirSync(join(extractDir, 'org-r-v4'), { recursive: true });

      // Throw a non-Error string to cover the `String(err)` ternary branch
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementationOnce(async () => {
          throw new String('plain-string-error');
        }),
      );
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const result = await fetchGithubRemoteExtend(
          { org: 'o', repo: 'r', tag: 'v4' },
          'ext',
          { refresh: true, allowOfflineFallback: true },
          cacheDir,
          buildCacheKey,
          false,
        );
        expect(result.resolvedPath).toContain('org-r-v4');
        const warned = warnSpy.mock.calls.flat().join(' ');
        expect(warned).toContain('plain-string-error');
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('default-branch fallback throws plain Error when last error is non-Error (line 155)', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-rem-defbr-'));
    try {
      // resolveLatestTag fails so we go to fetchGithubDefaultBranch
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' }),
      );
      // Make every fetchGitRemoteExtend call throw a non-Error
      mockFetchGitRemoteExtend.mockImplementation(async () => {
        throw new String('string-error-from-clone');
      });

      await expect(
        fetchGithubRemoteExtend(
          { org: 'o', repo: 'r', tag: 'latest' },
          'ext',
          {},
          cacheDir,
          buildCacheKey,
          true,
        ),
      ).rejects.toThrow();
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});
