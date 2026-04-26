import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGithubRemoteExtend } from '../../../src/config/remote/github-remote.js';

const mockFetchGitRemoteExtend = vi.hoisted(() => vi.fn());
const mockTarExtract = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../../src/config/remote/git-remote.js', () => ({
  fetchGitRemoteExtend: mockFetchGitRemoteExtend,
}));

vi.mock('tar', () => ({
  extract: mockTarExtract,
}));

function buildCacheKey(provider: string, identifier: string, ref: string): string {
  // Avoid `:` in the path: it's reserved on Windows filenames (NTFS alternate
  // streams) and the cache key is used directly as a directory name.
  const safe = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe(provider)}__${safe(identifier)}__${safe(ref)}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchGithubRemoteExtend', () => {
  it('rethrows latest-tag lookup failures when default-branch fallback is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(
      fetchGithubRemoteExtend(
        { org: 'sampleXbro', repo: 'agentsmesh-acrshmp', tag: 'latest' },
        'shared-rules',
        {},
        '/tmp/cache',
        buildCacheKey,
      ),
    ).rejects.toThrow(/Failed to resolve latest release/);

    expect(mockFetchGitRemoteExtend).not.toHaveBeenCalled();
  });

  it('falls back to cloning the default branch when no release exists and the source omitted @tag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );
    mockFetchGitRemoteExtend.mockResolvedValue({
      resolvedPath: join('/tmp', 'repo'),
      version: 'abc123',
    });

    const result = await fetchGithubRemoteExtend(
      { org: 'sampleXbro', repo: 'agentsmesh-acrshmp', tag: 'latest' },
      'shared-rules',
      {},
      '/tmp/cache',
      buildCacheKey,
      true,
    );

    expect(mockFetchGitRemoteExtend).toHaveBeenCalledWith(
      { url: 'https://github.com/sampleXbro/agentsmesh-acrshmp.git' },
      'shared-rules',
      {},
      '/tmp/cache',
      buildCacheKey,
    );
    expect(result).toEqual({
      resolvedPath: join('/tmp', 'repo'),
      version: 'abc123',
    });
  });

  it('retries GitHub default-branch fallback over SSH when HTTPS clone auth fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );
    mockFetchGitRemoteExtend
      .mockRejectedValueOnce(new Error('https auth failed'))
      .mockResolvedValueOnce({
        resolvedPath: join('/tmp', 'repo'),
        version: 'def456',
      });

    const result = await fetchGithubRemoteExtend(
      { org: 'sampleXbro', repo: 'agentsmesh-acrshmp', tag: 'latest' },
      'shared-rules',
      {},
      '/tmp/cache',
      buildCacheKey,
      true,
    );

    expect(mockFetchGitRemoteExtend.mock.calls).toEqual([
      [
        { url: 'https://github.com/sampleXbro/agentsmesh-acrshmp.git' },
        'shared-rules',
        {},
        '/tmp/cache',
        buildCacheKey,
      ],
      [
        { url: 'ssh://git@github.com/sampleXbro/agentsmesh-acrshmp.git' },
        'shared-rules',
        {},
        '/tmp/cache',
        buildCacheKey,
      ],
    ]);
    expect(result).toEqual({
      resolvedPath: join('/tmp', 'repo'),
      version: 'def456',
    });
  });

  it('uses only the tokenized HTTPS clone URL during default-branch fallback when a token is available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );
    mockFetchGitRemoteExtend.mockRejectedValueOnce(new Error('token auth failed'));

    await expect(
      fetchGithubRemoteExtend(
        { org: 'sampleXbro', repo: 'agentsmesh-acrshmp', tag: 'latest' },
        'shared-rules',
        { token: 'ghp secret/token' },
        '/tmp/cache',
        buildCacheKey,
        true,
      ),
    ).rejects.toThrow('token auth failed');

    expect(mockFetchGitRemoteExtend.mock.calls).toEqual([
      [
        {
          url: 'https://x-access-token:ghp%20secret%2Ftoken@github.com/sampleXbro/agentsmesh-acrshmp.git',
        },
        'shared-rules',
        { token: 'ghp secret/token' },
        '/tmp/cache',
        buildCacheKey,
      ],
    ]);
  });

  it('returns resolvedPath even when .agentsmesh/ is absent (native format repo)', async () => {
    const cacheDir = join(tmpdir(), 'am-gh-remote-native-test');
    mkdirSync(cacheDir, { recursive: true });

    // latest tag resolves to v1.0.0; tarball download succeeds
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tag_name: 'v1.0.0' }) })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    );

    // tar.extract is mocked — instead of real extraction, create the top-level dir manually
    // so findExtractTopDir returns a result (without .agentsmesh/ inside)
    mockTarExtract.mockImplementationOnce(async (opts: { cwd: string }) => {
      mkdirSync(join(opts.cwd, 'org-repo-v1.0.0'), { recursive: true });
    });

    const result = await fetchGithubRemoteExtend(
      { org: 'org', repo: 'repo', tag: 'latest' },
      'test-extend',
      {},
      cacheDir,
      buildCacheKey,
      false,
    );

    expect(result.version).toBe('v1.0.0');
    expect(result.resolvedPath).toContain('org-repo');
    // No throw — caller handles missing .agentsmesh/

    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('passes a tar extraction filter that rejects zip-slip paths', async () => {
    const cacheDir = join(tmpdir(), 'am-gh-remote-zipslip-test');
    mkdirSync(cacheDir, { recursive: true });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tag_name: 'v1.0.0' }) })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    );

    mockTarExtract.mockImplementationOnce(
      async (opts: {
        cwd: string;
        strict?: boolean;
        filter?: (entryPath: string, entry?: { type?: string }) => boolean;
      }) => {
        expect(opts.strict).toBe(true);
        expect(opts.filter?.('../escape.txt')).toBe(false);
        expect(opts.filter?.('/absolute/path.txt')).toBe(false);
        expect(opts.filter?.('org-repo-v1.0.0/.agentsmesh/rules/_root.md')).toBe(true);
        expect(opts.filter?.('org-repo-v1.0.0/link', { type: 'SymbolicLink' })).toBe(false);
        expect(opts.filter?.('org-repo-v1.0.0/hardlink', { type: 'Link' })).toBe(false);
        mkdirSync(join(opts.cwd, 'org-repo-v1.0.0'), { recursive: true });
      },
    );

    const result = await fetchGithubRemoteExtend(
      { org: 'org', repo: 'repo', tag: 'latest' },
      'test-extend',
      {},
      cacheDir,
      buildCacheKey,
      false,
    );

    expect(result.version).toBe('v1.0.0');
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
