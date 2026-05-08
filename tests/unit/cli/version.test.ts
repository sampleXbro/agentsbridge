import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>).__AGENTSMESH_VERSION__;
});

describe('getVersion', () => {
  it('returns version from package.json in normal mode', async () => {
    const { getVersion } = await import('../../../src/cli/version.js');
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
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
