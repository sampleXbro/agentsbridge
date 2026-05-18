/**
 * Regression tests for Batch 3 remote-fetch hardening:
 *   M2: Content-Length cap + streaming size guard
 *   M3: refuse git refs/clone-urls starting with "-"
 *   L2: validate AGENTSMESH_CACHE env override
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  MAX_TARBALL_BYTES,
  readBoundedResponse,
} from '../../../src/config/remote/github-remote.js';
import { getCacheDir } from '../../../src/config/remote/remote-fetcher.js';
import {
  gitLsRemoteResolve,
  resolveRemoteRefForInstall,
} from '../../../src/install/source/git-pin.js';

const ORIGINAL_CACHE_ENV = process.env.AGENTSMESH_CACHE;

afterEach(() => {
  if (ORIGINAL_CACHE_ENV === undefined) {
    delete process.env.AGENTSMESH_CACHE;
  } else {
    process.env.AGENTSMESH_CACHE = ORIGINAL_CACHE_ENV;
  }
});

describe('readBoundedResponse (M2)', () => {
  it('reads a small response normally', async () => {
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    const res = new Response(body, { headers: { 'content-length': '5' } });
    const out = await readBoundedResponse(res, 1024);
    expect(out).toEqual(body);
  });

  it('rejects fast on declared Content-Length over cap', async () => {
    const res = new Response(new Uint8Array([0]), {
      headers: { 'content-length': String(MAX_TARBALL_BYTES + 1) },
    });
    await expect(readBoundedResponse(res, MAX_TARBALL_BYTES)).rejects.toThrow(/declared/);
  });

  it('aborts mid-stream when running total exceeds cap', async () => {
    const big = new Uint8Array(2048).fill(7);
    // Response body without Content-Length so we exercise the streaming path
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(big);
        controller.enqueue(big);
        controller.close();
      },
    });
    const res = new Response(stream);
    await expect(readBoundedResponse(res, 2048)).rejects.toThrow(/streaming/);
  });
});

describe('git option-injection guards (M3)', () => {
  it('refuses ref starting with "-"', async () => {
    await expect(
      gitLsRemoteResolve('https://example.com/repo.git', '--upload-pack=evil'),
    ).rejects.toThrow(/option-injection/);
  });

  it('refuses remote URL starting with "-"', async () => {
    await expect(gitLsRemoteResolve('--upload-pack=evil', 'main')).rejects.toThrow(
      /option-injection/,
    );
  });

  it('resolveRemoteRefForInstall refuses dash refs', async () => {
    await expect(
      resolveRemoteRefForInstall('--upload-pack=evil', 'https://example.com/repo.git'),
    ).rejects.toThrow(/option-injection/);
  });
});

describe('AGENTSMESH_CACHE validation (L2)', () => {
  it('accepts a valid absolute path', () => {
    process.env.AGENTSMESH_CACHE = '/tmp/agentsmesh-cache';
    expect(getCacheDir()).toBe('/tmp/agentsmesh-cache');
  });

  it('rejects a relative path', () => {
    process.env.AGENTSMESH_CACHE = 'relative/path';
    expect(() => getCacheDir()).toThrow(/absolute path/);
  });

  it('rejects the filesystem root', () => {
    process.env.AGENTSMESH_CACHE = '/';
    expect(() => getCacheDir()).toThrow(/filesystem root/);
  });

  it('rejects a Windows root', () => {
    process.env.AGENTSMESH_CACHE = 'C:\\';
    expect(() => getCacheDir()).toThrow(/filesystem root/);
  });

  it('treats empty/whitespace-only as unset', () => {
    process.env.AGENTSMESH_CACHE = '   ';
    expect(getCacheDir()).toMatch(/\.agentsmesh[\\/]cache$/);
  });
});

describe('AGENTSMESH_MAX_TARBALL_MB (env override)', () => {
  const ORIGINAL = process.env.AGENTSMESH_MAX_TARBALL_MB;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.AGENTSMESH_MAX_TARBALL_MB;
    else process.env.AGENTSMESH_MAX_TARBALL_MB = ORIGINAL;
    vi.resetModules();
  });

  it('uses default 500 MiB when env var is unset', async () => {
    delete process.env.AGENTSMESH_MAX_TARBALL_MB;
    vi.resetModules();
    const mod = await import('../../../src/config/remote/github-remote.js');
    expect(mod.MAX_TARBALL_BYTES).toBe(500 * 1024 * 1024);
  });

  it('honors a valid AGENTSMESH_MAX_TARBALL_MB override', async () => {
    process.env.AGENTSMESH_MAX_TARBALL_MB = '1024';
    vi.resetModules();
    const mod = await import('../../../src/config/remote/github-remote.js');
    expect(mod.MAX_TARBALL_BYTES).toBe(1024 * 1024 * 1024);
  });

  it('falls back to default when env var is non-numeric', async () => {
    process.env.AGENTSMESH_MAX_TARBALL_MB = 'banana';
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../../../src/config/remote/github-remote.js');
    expect(mod.MAX_TARBALL_BYTES).toBe(500 * 1024 * 1024);
    warnSpy.mockRestore();
  });

  it('clamps below 1 MiB to default', async () => {
    process.env.AGENTSMESH_MAX_TARBALL_MB = '0';
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../../../src/config/remote/github-remote.js');
    expect(mod.MAX_TARBALL_BYTES).toBe(500 * 1024 * 1024);
    warnSpy.mockRestore();
  });

  it('clamps above 4096 MiB to default', async () => {
    process.env.AGENTSMESH_MAX_TARBALL_MB = '9999';
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../../../src/config/remote/github-remote.js');
    expect(mod.MAX_TARBALL_BYTES).toBe(500 * 1024 * 1024);
    warnSpy.mockRestore();
  });
});
