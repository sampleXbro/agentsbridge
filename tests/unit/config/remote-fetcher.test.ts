/**
 * Unit tests for remote extend fetcher (github:org/repo@tag).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import {
  parseGithubSource,
  fetchRemoteExtend,
  getCacheDir,
  resolveLatestTag,
} from '../../../src/config/remote-fetcher.js';

const CACHE_ROOT = join(tmpdir(), 'agentsbridge-remote-fetcher-test');

beforeEach(() => mkdirSync(CACHE_ROOT, { recursive: true }));
afterEach(() => rmSync(CACHE_ROOT, { recursive: true, force: true }));

describe('parseGithubSource', () => {
  it('parses github:org/repo@tag', () => {
    const result = parseGithubSource('github:my-org/ai-config@v2.1.0');
    expect(result).toEqual({ org: 'my-org', repo: 'ai-config', tag: 'v2.1.0' });
  });

  it('parses github:org/repo@latest', () => {
    const result = parseGithubSource('github:org/repo@latest');
    expect(result).toEqual({ org: 'org', repo: 'repo', tag: 'latest' });
  });

  it('parses github:org/repo without @tag (defaults to latest)', () => {
    const result = parseGithubSource('github:org/repo');
    expect(result).toEqual({ org: 'org', repo: 'repo', tag: 'latest' });
  });

  it('returns null for non-github source', () => {
    expect(parseGithubSource('./local/path')).toBeNull();
    expect(parseGithubSource('https://example.com/archive.tar.gz')).toBeNull();
  });

  it('returns null for malformed github source', () => {
    expect(parseGithubSource('github:')).toBeNull();
    expect(parseGithubSource('github:org')).toBeNull();
    expect(parseGithubSource('github:org/repo@')).toBeNull();
  });
});

describe('fetchRemoteExtend', () => {
  it('throws for non-github source', async () => {
    await expect(fetchRemoteExtend('https://example.com/archive.tar.gz', 'ext1')).rejects.toThrow(
      /github:|not a github|Invalid/,
    );
  });

  it('throws for malformed github:org/repo@', async () => {
    await expect(fetchRemoteExtend('github:org/repo@', 'ext1')).rejects.toThrow(/Invalid github/);
  });

  it('fetches, extracts, and returns resolved path (mocked fetch)', async () => {
    const srcDir = join(CACHE_ROOT, 'repo-src');
    const innerDir = join(srcDir, 'my-org-config-v1.0.0', '.agentsbridge', 'rules');
    mkdirSync(innerDir, { recursive: true });
    writeFileSync(join(innerDir, '_root.md'), '---\nroot: true\n---\n# Root\n');

    const tarball = join(CACHE_ROOT, 'mock.tar.gz');
    await tar.c({ file: tarball, gzip: true, cwd: srcDir }, ['my-org-config-v1.0.0']);

    const tarballBytes = readFileSync(tarball);
    const ab = new ArrayBuffer(tarballBytes.length);
    new Uint8Array(ab).set(new Uint8Array(tarballBytes));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(ab),
      }),
    );

    const result = await fetchRemoteExtend('github:my-org/config@v1.0.0', 'ext1', {
      cacheDir: CACHE_ROOT,
    });

    expect(result.resolvedPath).toContain('my-org-config');
    expect(result.version).toBe('v1.0.0');
    expect(existsSync(join(result.resolvedPath, '.agentsbridge', 'rules', '_root.md'))).toBe(true);
    expect(existsSync(join(dirname(result.resolvedPath), 'archive.tar.gz'))).toBe(false);

    vi.unstubAllGlobals();
  });

  it('uses cached version when fetch fails (offline fallback)', async () => {
    const srcDir = join(CACHE_ROOT, 'repo-src');
    const innerDir = join(srcDir, 'org-cache-v1.0.0', '.agentsbridge', 'rules');
    mkdirSync(innerDir, { recursive: true });
    writeFileSync(join(innerDir, '_root.md'), '---\nroot: true\n---\n# Cached\n');

    const tarball = join(CACHE_ROOT, 'cached.tar.gz');
    await tar.c({ file: tarball, gzip: true, cwd: srcDir }, ['org-cache-v1.0.0']);
    const tarballBytes = readFileSync(tarball);
    const ab = new ArrayBuffer(tarballBytes.length);
    new Uint8Array(ab).set(new Uint8Array(tarballBytes));

    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: true, arrayBuffer: () => Promise.resolve(ab) };
        }
        throw new Error('Offline');
      }),
    );

    const first = await fetchRemoteExtend('github:org/cache@v1.0.0', 'ext1', {
      cacheDir: CACHE_ROOT,
    });
    expect(first.resolvedPath).toContain('org-cache');
    expect(first.version).toBe('v1.0.0');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    const second = await fetchRemoteExtend('github:org/cache@v1.0.0', 'ext1', {
      cacheDir: CACHE_ROOT,
    });
    expect(second.resolvedPath).toBe(first.resolvedPath);
    expect(second.version).toBe('v1.0.0');

    vi.unstubAllGlobals();
  });

  it('refreshes an existing cached extend when refresh is enabled', async () => {
    const staleTopDir = join(
      CACHE_ROOT,
      'org-refresh-v1_0_0',
      'org-refresh-v1.0.0',
      '.agentsbridge',
      'rules',
    );
    mkdirSync(staleTopDir, { recursive: true });
    writeFileSync(join(staleTopDir, '_root.md'), '# Stale cache');

    const srcDir = join(CACHE_ROOT, 'repo-refresh');
    const freshInnerDir = join(srcDir, 'org-refresh-v1.0.0', '.agentsbridge', 'rules');
    mkdirSync(freshInnerDir, { recursive: true });
    writeFileSync(join(freshInnerDir, '_root.md'), '# Fresh remote');

    const tarball = join(CACHE_ROOT, 'refresh.tar.gz');
    await tar.c({ file: tarball, gzip: true, cwd: srcDir }, ['org-refresh-v1.0.0']);

    const tarballBytes = readFileSync(tarball);
    const ab = new ArrayBuffer(tarballBytes.length);
    new Uint8Array(ab).set(new Uint8Array(tarballBytes));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(ab),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchRemoteExtend('github:org/refresh@v1.0.0', 'ext-refresh', {
      cacheDir: CACHE_ROOT,
      refresh: true,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(
      readFileSync(join(result.resolvedPath, '.agentsbridge', 'rules', '_root.md'), 'utf-8'),
    ).toContain('Fresh remote');

    vi.unstubAllGlobals();
  });

  it('returns cached result when cache pre-populated (offline)', async () => {
    const srcDir = join(CACHE_ROOT, 'repo-offline');
    const innerDir = join(srcDir, 'org-ext-v2.0.0', '.agentsbridge', 'rules');
    mkdirSync(innerDir, { recursive: true });
    writeFileSync(join(innerDir, '_root.md'), '# Cached');

    const tarball = join(CACHE_ROOT, 'mock-offline.tar.gz');
    await tar.c({ file: tarball, gzip: true, cwd: srcDir }, ['org-ext-v2.0.0']);

    const cacheKey = 'org-ext-v2_0_0';
    const extractDir = join(CACHE_ROOT, cacheKey);
    mkdirSync(extractDir, { recursive: true });
    await tar.x({ file: tarball, cwd: extractDir });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await fetchRemoteExtend('github:org/ext@v2.0.0', 'ext1', {
      cacheDir: CACHE_ROOT,
    });

    expect(result.resolvedPath).toContain('org-ext');
    expect(result.version).toBe('v2.0.0');

    vi.unstubAllGlobals();
  });

  it('adds token to tarball fetch when provided', async () => {
    const srcDir = join(CACHE_ROOT, 'repo-token');
    const innerDir = join(srcDir, 'org-token-v1.0.0', '.agentsbridge', 'rules');
    mkdirSync(innerDir, { recursive: true });
    writeFileSync(join(innerDir, '_root.md'), '---\nroot: true\n---\n# Root\n');

    const tarball = join(CACHE_ROOT, 'token.tar.gz');
    await tar.c({ file: tarball, gzip: true, cwd: srcDir }, ['org-token-v1.0.0']);
    const tarballBytes = readFileSync(tarball);
    const ab = new ArrayBuffer(tarballBytes.length);
    new Uint8Array(ab).set(new Uint8Array(tarballBytes));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(ab),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchRemoteExtend('github:org/token@v1.0.0', 'ext1', {
      cacheDir: CACHE_ROOT,
      token: 'ghp_secret',
    });

    const tarballCall = mockFetch.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('tarball'),
    );
    expect(tarballCall).toBeDefined();
    expect(tarballCall[1]?.headers).toMatchObject({
      Authorization: 'Bearer ghp_secret',
    });

    vi.unstubAllGlobals();
  });

  it('uses cached copy when fetch throws but cache exists (mocked exists)', async () => {
    const cacheKey = 'org-fallback-v1_0_0';
    const extractDir = join(CACHE_ROOT, cacheKey);
    const topDir = 'org-fallback-abc123';
    const innerDir = join(extractDir, topDir, '.agentsbridge', 'rules');
    mkdirSync(innerDir, { recursive: true });
    writeFileSync(join(innerDir, '_root.md'), '# Cached');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unreachable')));

    const fsMod = await import('../../../src/utils/fs.js');
    let existsCallCount = 0;
    const existsSpy = vi.spyOn(fsMod, 'exists').mockImplementation(async (path: string) => {
      if (path.includes('org-fallback-v1_0_0')) {
        existsCallCount++;
        return existsCallCount > 1;
      }
      const { access } = await import('node:fs/promises');
      const { constants } = await import('node:fs');
      try {
        await access(path, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const result = await fetchRemoteExtend('github:org/fallback@v1.0.0', 'ext-offline', {
        cacheDir: CACHE_ROOT,
      });

      expect(result.resolvedPath).toContain('org-fallback');
      expect(result.version).toBe('v1.0.0');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Network failed'));
    } finally {
      existsSpy.mockRestore();
      warnSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe('resolveLatestTag', () => {
  it('resolves latest tag from GitHub API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tag_name: 'v3.2.1' }),
      }),
    );
    const tag = await resolveLatestTag('org', 'repo');
    expect(tag).toBe('v3.2.1');
    vi.unstubAllGlobals();
  });

  it('includes token in Authorization header when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v1.0.0' }),
    });
    vi.stubGlobal('fetch', mockFetch);
    await resolveLatestTag('org', 'repo', 'ghp_abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ghp_abc123' }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('throws when API returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
    );
    await expect(resolveLatestTag('org', 'repo')).rejects.toThrow(/404|Failed to resolve/);
    vi.unstubAllGlobals();
  });

  it('throws when tag_name is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    await expect(resolveLatestTag('org', 'repo')).rejects.toThrow(/No tag_name|tag_name/);
    vi.unstubAllGlobals();
  });
});

describe('getCacheDir', () => {
  it('returns AGENTSBRIDGE_CACHE when set', () => {
    const custom = '/custom/cache';
    process.env.AGENTSBRIDGE_CACHE = custom;
    expect(getCacheDir()).toBe(custom);
    delete process.env.AGENTSBRIDGE_CACHE;
  });

  it('returns ~/.agentsbridge/cache when AGENTSBRIDGE_CACHE not set', () => {
    delete process.env.AGENTSBRIDGE_CACHE;
    const dir = getCacheDir();
    expect(dir).toMatch(/\.agentsbridge[\\/]cache$/);
  });
});
