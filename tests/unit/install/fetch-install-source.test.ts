import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInstallSource } from '../../../src/install/source/fetch-install-source.js';
import { fetchRemoteExtend } from '../../../src/config/remote/remote-fetcher.js';
import { resolveRemoteRefForInstall } from '../../../src/install/source/git-pin.js';
import { getCacheDir } from '../../../src/config/remote/remote-fetcher.js';
import type { ParsedInstallSource } from '../../../src/install/source/url-parser.js';

vi.mock('../../../src/config/remote/remote-fetcher.js');
vi.mock('../../../src/install/source/git-pin.js');

const mockFetchRemoteExtend = vi.mocked(fetchRemoteExtend);
const mockResolveRemoteRefForInstall = vi.mocked(resolveRemoteRefForInstall);
const mockGetCacheDir = vi.mocked(getCacheDir);

describe('fetchInstallSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCacheDir.mockReturnValue('/cache/dir');
  });

  it('returns local source as-is', async () => {
    const localSource: ParsedInstallSource = {
      kind: 'local',
      rawRef: '',
      pathInRepo: 'skills/test',
      localRoot: '/local/path',
      localSourceForYaml: './local/path',
    };

    const result = await fetchInstallSource(localSource);

    expect(result).toEqual({
      resolvedPath: '/local/path',
      sourceForYaml: './local/path',
    });
    expect(mockResolveRemoteRefForInstall).not.toHaveBeenCalled();
    expect(mockFetchRemoteExtend).not.toHaveBeenCalled();
  });

  it('fetches GitHub sources', async () => {
    const githubSource: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'main',
      org: 'test-org',
      repo: 'test-repo',
      gitRemoteUrl: 'https://github.com/test-org/test-repo.git',
      pathInRepo: 'skills/test',
    };

    mockResolveRemoteRefForInstall.mockResolvedValue('abc123');
    mockFetchRemoteExtend.mockResolvedValue({
      resolvedPath: '/cached/path',
      version: 'abc123',
    });

    const result = await fetchInstallSource(githubSource);

    expect(mockResolveRemoteRefForInstall).toHaveBeenCalledWith(
      'main',
      'https://github.com/test-org/test-repo.git',
    );
    expect(mockFetchRemoteExtend).toHaveBeenCalledWith(
      'github:test-org/test-repo@abc123',
      'install',
      {
        cacheDir: '/cache/dir',
        refresh: false,
        allowOfflineFallback: false,
      },
    );
    expect(result).toEqual({
      resolvedPath: '/cached/path',
      sourceForYaml: 'github:test-org/test-repo@abc123',
      version: 'abc123',
    });
  });

  it('fetches GitLab sources', async () => {
    const gitlabSource: ParsedInstallSource = {
      kind: 'gitlab',
      rawRef: 'v1.0',
      org: 'test-group',
      repo: 'test-project',
      gitRemoteUrl: 'https://gitlab.com/test-group/test-project.git',
      pathInRepo: 'skills/test',
    };

    mockResolveRemoteRefForInstall.mockResolvedValue('def456');
    mockFetchRemoteExtend.mockResolvedValue({
      resolvedPath: '/cached/gitlab/path',
      version: 'def456',
    });

    const result = await fetchInstallSource(gitlabSource);

    expect(mockResolveRemoteRefForInstall).toHaveBeenCalledWith(
      'v1.0',
      'https://gitlab.com/test-group/test-project.git',
    );
    expect(mockFetchRemoteExtend).toHaveBeenCalledWith(
      'gitlab:test-group/test-project@def456',
      'install',
      {
        cacheDir: '/cache/dir',
        refresh: false,
        allowOfflineFallback: false,
      },
    );
    expect(result).toEqual({
      resolvedPath: '/cached/gitlab/path',
      sourceForYaml: 'gitlab:test-group/test-project@def456',
      version: 'def456',
    });
  });

  it('fetches generic git sources', async () => {
    const gitSource: ParsedInstallSource = {
      kind: 'git',
      rawRef: 'feature-branch',
      gitRemoteUrl: 'https://git.example.com/user/repo.git',
      pathInRepo: 'skills/test',
    };

    mockResolveRemoteRefForInstall.mockResolvedValue('ghi789');
    mockFetchRemoteExtend.mockResolvedValue({
      resolvedPath: '/cached/git/path',
      version: 'ghi789',
    });

    const result = await fetchInstallSource(gitSource);

    expect(mockResolveRemoteRefForInstall).toHaveBeenCalledWith(
      'feature-branch',
      'https://git.example.com/user/repo.git',
    );
    expect(mockFetchRemoteExtend).toHaveBeenCalledWith(
      'git+https://git.example.com/user/repo.git#ghi789',
      'install',
      {
        cacheDir: '/cache/dir',
        refresh: false,
        allowOfflineFallback: false,
      },
    );
    expect(result).toEqual({
      resolvedPath: '/cached/git/path',
      sourceForYaml: 'git+https://git.example.com/user/repo.git#ghi789',
      version: 'ghi789',
    });
  });

  it('handles git+ sources with base URL', async () => {
    const gitPlusSource: ParsedInstallSource = {
      kind: 'git',
      rawRef: 'main',
      gitRemoteUrl: 'https://git.example.com/user/repo.git',
      gitPlusBase: 'https://git.example.com/user/repo',
      pathInRepo: 'skills/test',
    };

    mockResolveRemoteRefForInstall.mockResolvedValue('jkl012');
    mockFetchRemoteExtend.mockResolvedValue({
      resolvedPath: '/cached/gitplus/path',
      version: 'jkl012',
    });

    const result = await fetchInstallSource(gitPlusSource);

    expect(mockFetchRemoteExtend).toHaveBeenCalledWith(
      'git+https://git.example.com/user/repo#jkl012',
      'install',
      {
        cacheDir: '/cache/dir',
        refresh: false,
        allowOfflineFallback: false,
      },
    );
    expect(result).toEqual({
      resolvedPath: '/cached/gitplus/path',
      sourceForYaml: 'git+https://git.example.com/user/repo#jkl012',
      version: 'jkl012',
    });
  });

  it('throws error when git remote URL is missing', async () => {
    const invalidSource: ParsedInstallSource = {
      kind: 'git',
      rawRef: 'main',
      pathInRepo: 'skills/test',
    };

    await expect(fetchInstallSource(invalidSource)).rejects.toThrow(
      'Internal error: missing git remote URL',
    );
  });
});
