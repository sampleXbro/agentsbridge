import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>).__AGENTSMESH_VERSION__;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__AGENTSMESH_VERSION__;
  vi.restoreAllMocks();
});

describe('getVersion', () => {
  it('returns version from package.json in normal mode', async () => {
    const { getVersion } = await import('../../../src/cli/version.js');
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('memoizes the resolved version across calls', async () => {
    const { getVersion } = await import('../../../src/cli/version.js');
    const first = getVersion();
    expect(getVersion()).toBe(first);
  });
});

describe('getVersionFallback', () => {
  it('returns globalThis.__AGENTSMESH_VERSION__ when set', async () => {
    (globalThis as Record<string, unknown>).__AGENTSMESH_VERSION__ = '99.0.0-binary';
    const { getVersionFallback } = await import('../../../src/cli/version.js');
    expect(getVersionFallback()).toBe('99.0.0-binary');
  });

  it('returns "unknown" when no version source is available', async () => {
    const { getVersionFallback } = await import('../../../src/cli/version.js');
    expect(getVersionFallback()).toBe('unknown');
  });
});

describe('printVersion', () => {
  it('writes "agentsmesh v<version>" plus a newline to stdout', async () => {
    const { printVersion, getVersion } = await import('../../../src/cli/version.js');
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    printVersion();
    expect(chunks).toEqual([`agentsmesh v${getVersion()}\n`]);
    expect(chunks[0]).toMatch(/^agentsmesh v\d+\.\d+\.\d+/);
  });
});

describe('getVersion — package.json unreadable', () => {
  it('falls back to the embedded version when package.json cannot be required', async () => {
    (globalThis as Record<string, unknown>).__AGENTSMESH_VERSION__ = '7.7.7-embedded';
    vi.doMock('node:module', async (importOriginal) => ({
      ...(await importOriginal<typeof import('node:module')>()),
      createRequire: () => (): never => {
        throw new Error('package.json unreadable');
      },
    }));
    try {
      const { getVersion } = await import('../../../src/cli/version.js');
      expect(getVersion()).toBe('7.7.7-embedded');
    } finally {
      vi.doUnmock('node:module');
    }
  });
});
