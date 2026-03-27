import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;
type ExecFileOptions = { env?: NodeJS.ProcessEnv };
type ExecFileLike = (
  file: string,
  args: string[],
  options: ExecFileOptions,
  callback: ExecFileCallback,
) => void;

const execFileMock = vi.hoisted(() => vi.fn<ExecFileLike>());

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

import {
  gitLsRemoteResolve,
  isGitAvailable,
  resolveRemoteRefForInstall,
} from '../../../src/install/source/git-pin.js';

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

describe('git pin helpers', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('reports whether git is available', async () => {
    queueGitSuccess('git version 2.39.0\n');
    await expect(isGitAvailable()).resolves.toBe(true);

    queueGitFailure('spawn git ENOENT');
    await expect(isGitAvailable()).resolves.toBe(false);
  });

  it('tries raw, heads, and tags refs until it finds a valid sha', async () => {
    queueGitSuccess('\n');
    queueGitSuccess('not-a-sha\trefs/heads/release\n');
    queueGitSuccess('ABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD\trefs/tags/release\n');

    await expect(gitLsRemoteResolve('https://example.com/org/repo.git', 'release')).resolves.toBe(
      'ABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD',
    );

    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      ['ls-remote', 'https://example.com/org/repo.git', 'release'],
      ['ls-remote', 'https://example.com/org/repo.git', 'refs/heads/release'],
      ['ls-remote', 'https://example.com/org/repo.git', 'refs/tags/release'],
    ]);
  });

  it('throws with the last git error context when all remote ref attempts fail', async () => {
    queueGitFailure('network down');
    queueGitSuccess('\n');
    queueGitSuccess('still-not-a-sha\trefs/tags/release\n');

    await expect(gitLsRemoteResolve('https://example.com/org/repo.git', 'release')).rejects.toThrow(
      'network down',
    );
  });

  it('normalizes direct commit shas without shelling out', async () => {
    await expect(
      resolveRemoteRefForInstall('ABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD', 'unused'),
    ).resolves.toBe('abcdefabcdefabcdefabcdefabcdefabcdefabcd');

    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('resolves HEAD and validates the returned ls-remote line', async () => {
    queueGitSuccess('ABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD\tHEAD\n');

    await expect(resolveRemoteRefForInstall('', 'https://example.com/org/repo.git')).resolves.toBe(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
    );

    queueGitSuccess('not-a-sha\tHEAD\n');
    await expect(
      resolveRemoteRefForInstall('HEAD', 'https://example.com/org/repo.git'),
    ).rejects.toThrow(/Invalid ls-remote HEAD line/);
  });
});
