import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveExtendPaths } from '../../../src/config/resolve/resolver.js';
import { fetchRemoteExtend } from '../../../src/config/remote/remote-fetcher.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const mockFetchRemoteExtend = vi.hoisted(() => vi.fn());
vi.mock('../../../src/config/remote/remote-fetcher.js', () => ({
  parseGithubSource: () => null,
  fetchRemoteExtend: mockFetchRemoteExtend,
  getCacheDir: () => process.env.AGENTSMESH_CACHE ?? '/tmp/agentsmesh-cache',
}));

const TEST_ROOT = join(tmpdir(), 'agentsmesh-resolver-test');

beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

function minimalConfig(extendsList: ValidatedConfig['extends'] = []): ValidatedConfig {
  return {
    version: 1,
    targets: ['claude-code', 'cursor'],
    features: ['rules'],
    extends: extendsList,
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

describe('resolveExtendPaths', () => {
  it('returns empty array when no extends', async () => {
    const config = minimalConfig();
    const result = await resolveExtendPaths(config, TEST_ROOT);
    expect(result).toEqual([]);
  });

  it('resolves relative path ./path to absolute', async () => {
    const sharedDir = join(TEST_ROOT, 'shared');
    mkdirSync(sharedDir, { recursive: true });
    const config = minimalConfig([{ name: 'base', source: './shared', features: ['rules'] }]);
    const result = await resolveExtendPaths(config, TEST_ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'base',
      resolvedPath: sharedDir,
      features: ['rules'],
    });
  });

  it('resolves relative path ./sub/path with trailing slash', async () => {
    const extendDir = join(TEST_ROOT, 'company', 'base');
    mkdirSync(extendDir, { recursive: true });
    const config = minimalConfig([
      { name: 'company-base', source: './company/base/', features: ['rules', 'mcp'] },
    ]);
    const result = await resolveExtendPaths(config, TEST_ROOT);
    expect(result[0]?.resolvedPath).toBe(extendDir);
    expect(result[0]?.features).toEqual(['rules', 'mcp']);
  });

  it('resolves ../path when configDir is nested', async () => {
    const configDir = join(TEST_ROOT, 'project', 'nested');
    mkdirSync(configDir, { recursive: true });
    const sharedDir = join(TEST_ROOT, 'shared');
    mkdirSync(sharedDir, { recursive: true });
    const config = minimalConfig([{ name: 'up', source: '../../shared', features: ['rules'] }]);
    const result = await resolveExtendPaths(config, configDir);
    expect(result[0]?.resolvedPath).toBe(sharedDir);
  });

  it('throws when resolved path does not exist', async () => {
    const config = minimalConfig([
      { name: 'missing', source: './does-not-exist', features: ['rules'] },
    ]);
    await expect(resolveExtendPaths(config, TEST_ROOT)).rejects.toThrow(
      /does-not-exist.*not found|extend.*missing/i,
    );
  });

  it('throws when source is http/https URL (only github: supported)', async () => {
    const config = minimalConfig([
      {
        name: 'remote',
        source: 'https://github.com/org/repo/releases/latest/download/base.tar.gz',
        features: ['rules'],
      },
    ]);
    await expect(resolveExtendPaths(config, TEST_ROOT)).rejects.toThrow(
      /http|https|not supported|Use github/i,
    );
  });

  it('resolves github:org/repo@tag via remote fetcher (mocked)', async () => {
    const mockPath = join(TEST_ROOT, 'cached-gh');
    mkdirSync(join(mockPath, '.agentsmesh', 'rules'), { recursive: true });
    vi.mocked(fetchRemoteExtend).mockResolvedValue({
      resolvedPath: mockPath,
      version: 'v2.1.0',
    });
    const config = minimalConfig([
      { name: 'gh', source: 'github:my-org/ai-config@v2.1.0', features: ['rules'] },
    ]);
    const result = await resolveExtendPaths(config, TEST_ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'gh',
      resolvedPath: mockPath,
      features: ['rules'],
      version: 'v2.1.0',
    });
  });

  it('resolves gitlab:group/project@ref via remote fetcher (mocked)', async () => {
    const mockPath = join(TEST_ROOT, 'cached-gl');
    mkdirSync(join(mockPath, '.agentsmesh', 'rules'), { recursive: true });
    vi.mocked(fetchRemoteExtend).mockResolvedValue({
      resolvedPath: mockPath,
      version: '3d2f4c8',
    });
    const config = minimalConfig([
      { name: 'gl', source: 'gitlab:team/platform/agents@v2.0.0', features: ['rules'] },
    ]);

    const result = await resolveExtendPaths(config, TEST_ROOT);

    expect(result[0]).toMatchObject({
      name: 'gl',
      resolvedPath: mockPath,
      features: ['rules'],
      version: '3d2f4c8',
    });
  });

  it('resolves git+https remotes via remote fetcher (mocked)', async () => {
    const mockPath = join(TEST_ROOT, 'cached-git');
    mkdirSync(join(mockPath, '.agentsmesh', 'rules'), { recursive: true });
    vi.mocked(fetchRemoteExtend).mockResolvedValue({
      resolvedPath: mockPath,
      version: '9c1d7e0',
    });
    const config = minimalConfig([
      {
        name: 'generic',
        source: 'git+https://git.example.com/org/agentsmesh-config.git#main',
        features: ['rules'],
      },
    ]);

    const result = await resolveExtendPaths(config, TEST_ROOT);

    expect(result[0]).toMatchObject({
      name: 'generic',
      resolvedPath: mockPath,
      features: ['rules'],
      version: '9c1d7e0',
    });
  });

  it('clears entire cache dir when refreshCache is true and remotes exist', async () => {
    const cacheDir = join(TEST_ROOT, 'refresh-cache-dir');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'stale-file'), 'should be deleted');
    mkdirSync(join(cacheDir, 'old-extend'), { recursive: true });
    const mockPath = join(TEST_ROOT, 'cached-gh');
    mkdirSync(join(mockPath, '.agentsmesh', 'rules'), { recursive: true });
    vi.mocked(fetchRemoteExtend).mockResolvedValue({
      resolvedPath: mockPath,
      version: 'v1.0.0',
    });
    const origEnv = process.env.AGENTSMESH_CACHE;
    process.env.AGENTSMESH_CACHE = cacheDir;
    try {
      await resolveExtendPaths(
        minimalConfig([{ name: 'gh', source: 'github:org/repo@v1.0.0', features: ['rules'] }]),
        TEST_ROOT,
        { refreshCache: true },
      );
      expect(existsSync(join(cacheDir, 'stale-file'))).toBe(false);
      expect(existsSync(join(cacheDir, 'old-extend'))).toBe(false);
      expect(existsSync(cacheDir)).toBe(true);
    } finally {
      process.env.AGENTSMESH_CACHE = origEnv;
    }
  });

  it('resolves multiple extends in order', async () => {
    const dir1 = join(TEST_ROOT, 'shared');
    const dir2 = join(TEST_ROOT, 'typescript');
    mkdirSync(dir1, { recursive: true });
    mkdirSync(dir2, { recursive: true });
    const config = minimalConfig([
      { name: 'base', source: './shared', features: ['rules'] },
      { name: 'ts', source: './typescript', features: ['rules', 'skills'] },
    ]);
    const result = await resolveExtendPaths(config, TEST_ROOT);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'base', resolvedPath: dir1, features: ['rules'] });
    expect(result[1]).toEqual({
      name: 'ts',
      resolvedPath: dir2,
      features: ['rules', 'skills'],
    });
  });
});
