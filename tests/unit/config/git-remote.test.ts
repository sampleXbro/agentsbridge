import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn<ExecFileLike>());
const mkdirMock = vi.hoisted(() => vi.fn<(path: string, options?: object) => Promise<void>>());
const renameMock = vi.hoisted(() =>
  vi.fn<(from: string, to: string) => Promise<void>>().mockResolvedValue(undefined),
);
const rmMock = vi.hoisted(() =>
  vi.fn<(path: string, options?: object) => Promise<void>>().mockResolvedValue(undefined),
);
const existsMock = vi.hoisted(() => vi.fn<(path: string) => Promise<boolean>>());

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;
type ExecFileOptions = { cwd?: string; env?: NodeJS.ProcessEnv };
type ExecFileLike = (
  file: string,
  args: string[],
  options: ExecFileOptions,
  callback: ExecFileCallback,
) => void;

vi.mock('node:util', () => ({
  promisify: (fn: ExecFileLike) => {
    return (file: string, args: string[], options: ExecFileOptions) =>
      new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        fn(file, args, options, (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ stdout, stderr });
        });
      });
  },
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  rename: renameMock,
  rm: rmMock,
}));

vi.mock('../../../src/utils/filesystem/fs.js', () => ({
  exists: existsMock,
}));

import { fetchGitRemoteExtend } from '../../../src/config/remote/git-remote.js';

function buildCacheKey(provider: string, identifier: string, ref: string): string {
  return `${provider}__${identifier}__${ref}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function queueGitSuccess(stdout: string): void {
  execFileMock.mockImplementationOnce(
    (_file: string, _args: string[], _options: ExecFileOptions, callback: ExecFileCallback) => {
      callback(null, stdout, '');
    },
  );
}

function queueGitFailure(message: string): void {
  execFileMock.mockImplementationOnce(
    (_file: string, _args: string[], _options: ExecFileOptions, callback: ExecFileCallback) => {
      callback(new Error(message), '', '');
    },
  );
}

describe('fetchGitRemoteExtend', () => {
  beforeEach(() => {
    execFileMock.mockReset();
    mkdirMock.mockReset().mockResolvedValue(undefined);
    renameMock.mockReset().mockResolvedValue(undefined);
    rmMock.mockReset().mockResolvedValue(undefined);
    existsMock.mockReset();
    delete process.env.AGENTSMESH_GITLAB_TOKEN;
  });

  afterEach(() => {
    delete process.env.AGENTSMESH_GITLAB_TOKEN;
    vi.restoreAllMocks();
  });

  it('returns the cached clone without recloning when refresh is false', async () => {
    existsMock.mockResolvedValue(true);
    queueGitSuccess('cached-sha\n');

    const result = await fetchGitRemoteExtend(
      { url: 'file:///tmp/example.git' },
      'shared-rules',
      {},
      '/tmp/cache',
      buildCacheKey,
    );

    expect(result).toEqual({
      resolvedPath: '/tmp/cache/git__file____tmp_example_git__HEAD/repo',
      version: 'cached-sha',
    });
    expect(execFileMock).toHaveBeenCalledOnce();
    expect(mkdirMock).not.toHaveBeenCalled();
    expect(renameMock).not.toHaveBeenCalled();
  });

  it('clones, checks out refs, and injects the GitLab token for HTTPS clone urls', async () => {
    process.env.AGENTSMESH_GITLAB_TOKEN = 'secret token';
    existsMock.mockResolvedValue(false);
    queueGitSuccess('');
    queueGitSuccess('');
    queueGitSuccess('fresh-sha\n');

    const result = await fetchGitRemoteExtend(
      {
        namespace: 'team/subteam',
        project: 'project',
        ref: 'release/v1',
        cloneUrl: 'https://gitlab.com/team/subteam/project.git',
      },
      'shared-rules',
      {},
      '/tmp/cache',
      buildCacheKey,
    );

    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      'clone',
      'https://oauth2:secret%20token@gitlab.com/team/subteam/project.git',
      '/tmp/cache/gitlab__team_subteam_project__release_v1.tmp/repo',
    ]);
    expect(execFileMock.mock.calls[1]?.[1]).toEqual(['checkout', 'release/v1']);
    expect(result).toEqual({
      resolvedPath: '/tmp/cache/gitlab__team_subteam_project__release_v1/repo',
      version: 'fresh-sha',
    });
    expect(renameMock).toHaveBeenCalledWith(
      '/tmp/cache/gitlab__team_subteam_project__release_v1.tmp',
      '/tmp/cache/gitlab__team_subteam_project__release_v1',
    );
  });

  it('falls back to the cached clone after a failed refresh when offline fallback is allowed', async () => {
    existsMock.mockResolvedValue(true);
    queueGitFailure('clone failed');
    queueGitSuccess('cached-sha\n');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchGitRemoteExtend(
      { cloneUrl: 'ssh://git@gitlab.com/team/project.git', namespace: 'team', project: 'project' },
      'shared-rules',
      { refresh: true },
      '/tmp/cache',
      buildCacheKey,
    );

    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      'git',
      [
        'clone',
        'ssh://git@gitlab.com/team/project.git',
        '/tmp/cache/gitlab__team_project__HEAD.tmp/repo',
      ],
      expect.any(Object),
      expect.any(Function),
    );
    expect(result).toEqual({
      resolvedPath: '/tmp/cache/gitlab__team_project__HEAD/repo',
      version: 'cached-sha',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using cached version'));
    expect(renameMock).not.toHaveBeenCalled();
  });

  it('rethrows clone failures when offline fallback is disabled', async () => {
    existsMock.mockResolvedValue(false);
    queueGitFailure('clone failed');

    await expect(
      fetchGitRemoteExtend(
        { url: 'file:///tmp/example.git' },
        'shared-rules',
        { allowOfflineFallback: false, refresh: true },
        '/tmp/cache',
        buildCacheKey,
      ),
    ).rejects.toThrow('clone failed');

    expect(execFileMock).toHaveBeenCalledOnce();
  });
});
