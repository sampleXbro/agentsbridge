import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedInstallSource } from '../../../../src/install/source/url-parser.js';

vi.mock('../../../../src/install/source/fetch-install-source.js', () => ({
  fetchInstallSource: vi.fn(),
}));

import { fetchInstallSource } from '../../../../src/install/source/fetch-install-source.js';
import { resolveInstallResolvedPath } from '../../../../src/install/run/run-install-resolve.js';

const fetchMock = vi.mocked(fetchInstallSource);

const LOCAL: ParsedInstallSource = {
  kind: 'local',
  rawRef: '',
  pathInRepo: '',
  localRoot: '/work/pack',
  localSourceForYaml: './pack',
};

const GITHUB: ParsedInstallSource = {
  kind: 'github',
  rawRef: 'main',
  org: 'org',
  repo: 'repo',
  gitRemoteUrl: 'https://github.com/org/repo.git',
  pathInRepo: '',
};

const SUFFIX = 'Check your network connection and try again.';

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (e: unknown) {
    if (e instanceof Error) return e;
    throw new Error(`non-Error rejection: ${String(e)}`, { cause: e });
  }
  throw new Error('expected the promise to reject');
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('resolveInstallResolvedPath', () => {
  it('returns the local root and yaml source without fetching', async () => {
    await expect(resolveInstallResolvedPath(LOCAL, './pack')).resolves.toStrictEqual({
      resolvedPath: '/work/pack',
      sourceForYaml: './pack',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through the fetched path, yaml source and version', async () => {
    fetchMock.mockResolvedValueOnce({
      resolvedPath: '/cache/org-repo',
      sourceForYaml: 'github:org/repo@abc',
      version: 'abc',
    });

    await expect(resolveInstallResolvedPath(GITHUB, 'org/repo')).resolves.toStrictEqual({
      resolvedPath: '/cache/org-repo',
      sourceForYaml: 'github:org/repo@abc',
      version: 'abc',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(GITHUB);
  });

  it('wraps an Error from fetch with the source arg and keeps it as cause', async () => {
    const original = new Error('ECONNRESET');
    fetchMock.mockRejectedValueOnce(original);

    const err = await rejection(resolveInstallResolvedPath(GITHUB, 'org/repo'));

    expect(err.message).toBe(`Failed to fetch from org/repo: ECONNRESET. ${SUFFIX}`);
    expect(err.cause).toBe(original);
  });

  it('stringifies a non-Error rejection and leaves cause unset', async () => {
    fetchMock.mockRejectedValueOnce('offline');

    const err = await rejection(resolveInstallResolvedPath(GITHUB, 'git+https://x/y.git'));

    expect(err.message).toBe(`Failed to fetch from git+https://x/y.git: offline. ${SUFFIX}`);
    expect(err.cause).toBeUndefined();
  });
});
