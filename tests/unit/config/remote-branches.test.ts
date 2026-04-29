import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  fetchGithubRemoteExtend,
  resolveLatestTag,
} from '../../../src/config/remote/github-remote.js';
import {
  parseGithubSource,
  parseGitlabSource,
  parseGitSource,
  parseRemoteSource,
  isSupportedRemoteSource,
} from '../../../src/config/remote/remote-source.js';

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

describe('remote-source — branch coverage', () => {
  describe('parseGithubSource', () => {
    it('returns null when not prefixed', () => {
      expect(parseGithubSource('not-github')).toBeNull();
    });

    it('returns null when slug is empty', () => {
      expect(parseGithubSource('github:')).toBeNull();
    });

    it('returns null when slug has no slash', () => {
      expect(parseGithubSource('github:nor-repo')).toBeNull();
    });

    it('returns null when slug is "@" (after split)', () => {
      expect(parseGithubSource('github:@')).toBeNull();
    });

    it('returns null when slug part of @ is empty', () => {
      expect(parseGithubSource('github:org/@v1')).toBeNull();
    });
  });

  describe('parseGitlabSource', () => {
    it('returns null when not prefixed', () => {
      expect(parseGitlabSource('github:org/repo@v1')).toBeNull();
    });

    it('parses without ref (returns ref undefined)', () => {
      expect(parseGitlabSource('gitlab:ns/proj')).toEqual({
        namespace: 'ns',
        project: 'proj',
        ref: undefined,
        cloneUrl: 'https://gitlab.com/ns/proj.git',
      });
    });

    it('parses nested namespace with ref', () => {
      expect(parseGitlabSource('gitlab:g1/g2/proj@v1')).toEqual({
        namespace: 'g1/g2',
        project: 'proj',
        ref: 'v1',
        cloneUrl: 'https://gitlab.com/g1/g2/proj.git',
      });
    });

    it('returns null when slug has no slash', () => {
      expect(parseGitlabSource('gitlab:single@v1')).toBeNull();
    });
  });

  describe('parseGitSource', () => {
    it('returns null when not prefixed with git+', () => {
      expect(parseGitSource('https://example.com/x.git')).toBeNull();
    });

    it('returns null when rest is empty', () => {
      expect(parseGitSource('git+')).toBeNull();
    });

    it('parses URL without ref', () => {
      expect(parseGitSource('git+https://x.com/r.git')).toEqual({
        url: 'https://x.com/r.git',
        ref: undefined,
      });
    });

    it('parses URL with ref using #', () => {
      expect(parseGitSource('git+https://x.com/r.git#abc')).toEqual({
        url: 'https://x.com/r.git',
        ref: 'abc',
      });
    });

    it('returns null when ref is empty after #', () => {
      expect(parseGitSource('git+https://x.com/r.git#')).toBeNull();
    });

    it('returns null when URL is invalid', () => {
      expect(parseGitSource('git+:::not-a-url')).toBeNull();
    });

    it('returns null when protocol is unsupported (ftp)', () => {
      expect(parseGitSource('git+ftp://x.com/r.git')).toBeNull();
    });

    it('accepts ssh:// protocol', () => {
      expect(parseGitSource('git+ssh://git@host.com/r.git')).toEqual({
        url: 'ssh://git@host.com/r.git',
        ref: undefined,
      });
    });

    it('accepts file:// protocol', () => {
      const out = parseGitSource('git+file:///tmp/r');
      expect(out).not.toBeNull();
    });
  });

  describe('parseRemoteSource and isSupportedRemoteSource', () => {
    it('falls through all kinds, returns null on local path', () => {
      expect(parseRemoteSource('../local')).toBeNull();
      expect(isSupportedRemoteSource('../local')).toBe(false);
    });

    it('returns github kind first', () => {
      expect(parseRemoteSource('github:org/repo@v1')?.kind).toBe('github');
    });

    it('returns gitlab kind when github fails', () => {
      expect(parseRemoteSource('gitlab:ns/proj')?.kind).toBe('gitlab');
    });

    it('returns git kind when github+gitlab fail', () => {
      expect(parseRemoteSource('git+https://example.com/r.git')?.kind).toBe('git');
    });
  });
});

describe('github-remote — additional branches', () => {
  it('resolveLatestTag throws when API returns no tag_name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'v1' }),
      }),
    );
    await expect(resolveLatestTag('o', 'r')).rejects.toThrow(/No tag_name/);
  });

  it('resolveLatestTag uses Authorization header when token provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v9' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const tag = await resolveLatestTag('o', 'r', 'mytoken');
    expect(tag).toBe('v9');
    const headers = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe('Bearer mytoken');
  });

  it('uses cached extractDir when refresh=false and cache hit', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-cov-cache-'));
    try {
      const cacheKey = buildCacheKey('github', 'org/repo', 'v1');
      const extractDir = join(cacheDir, cacheKey);
      mkdirSync(join(extractDir, 'org-repo-v1'), { recursive: true });
      writeFileSync(join(extractDir, 'org-repo-v1', 'placeholder'), '');

      const result = await fetchGithubRemoteExtend(
        { org: 'org', repo: 'repo', tag: 'v1' },
        'ext',
        { refresh: false },
        cacheDir,
        buildCacheKey,
        false,
      );
      expect(result.version).toBe('v1');
      expect(result.resolvedPath).toContain('org-repo-v1');
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('falls back to cached version when network fails and cache exists', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-cov-cache-net-'));
    try {
      const cacheKey = buildCacheKey('github', 'org/repo', 'v2');
      const extractDir = join(cacheDir, cacheKey);
      mkdirSync(join(extractDir, 'org-repo-v2'), { recursive: true });

      // First fetch: tag_name resolution succeeds, archive fetch FAILS -> use cached version
      // refresh: true forces network attempt
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const result = await fetchGithubRemoteExtend(
          { org: 'org', repo: 'repo', tag: 'v2' },
          'ext',
          { refresh: true },
          cacheDir,
          buildCacheKey,
          false,
        );
        expect(result.resolvedPath).toContain('org-repo-v2');
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('rethrows when allowOfflineFallback=false and network fails', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-cov-cache-rethrow-'));
    try {
      const cacheKey = buildCacheKey('github', 'org/repo', 'v3');
      const extractDir = join(cacheDir, cacheKey);
      mkdirSync(join(extractDir, 'org-repo-v3'), { recursive: true });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('boom')));

      await expect(
        fetchGithubRemoteExtend(
          { org: 'org', repo: 'repo', tag: 'v3' },
          'ext',
          { refresh: true, allowOfflineFallback: false },
          cacheDir,
          buildCacheKey,
          false,
        ),
      ).rejects.toThrow(/boom/);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('throws when archive has no top-level directory', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'amesh-cov-cache-empty-'));
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
      );
      mockTarExtract.mockImplementationOnce(async () => {
        // Don't create any directories — simulate empty extraction
      });
      await expect(
        fetchGithubRemoteExtend(
          { org: 'org', repo: 'repo', tag: 'v4' },
          'ext',
          {},
          cacheDir,
          buildCacheKey,
          false,
        ),
      ).rejects.toThrow(/archive has no top-level directory/);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});
