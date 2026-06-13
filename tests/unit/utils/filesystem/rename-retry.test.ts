import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renameMock = vi.hoisted(() => vi.fn<(from: string, to: string) => Promise<void>>());

vi.mock('node:fs/promises', () => ({ rename: renameMock }));

import { renameWithRetry } from '../../../../src/utils/filesystem/rename-retry.js';

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: operation not permitted, rename`), { code });
}

describe('renameWithRetry', () => {
  beforeEach(() => renameMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('resolves on the first successful rename', async () => {
    renameMock.mockResolvedValueOnce(undefined);
    await renameWithRetry('a', 'b', { delayMs: 0 });
    expect(renameMock).toHaveBeenCalledTimes(1);
    expect(renameMock).toHaveBeenCalledWith('a', 'b');
  });

  it('retries a transient EPERM then succeeds (Windows post-clone lock)', async () => {
    renameMock
      .mockRejectedValueOnce(errno('EPERM'))
      .mockRejectedValueOnce(errno('EBUSY'))
      .mockResolvedValueOnce(undefined);
    await renameWithRetry('a', 'b', { delayMs: 0 });
    expect(renameMock).toHaveBeenCalledTimes(3);
  });

  it('rethrows immediately on a non-transient error (e.g. ENOENT)', async () => {
    renameMock.mockRejectedValueOnce(errno('ENOENT'));
    await expect(renameWithRetry('a', 'b', { delayMs: 0 })).rejects.toMatchObject({ code: 'ENOENT' });
    expect(renameMock).toHaveBeenCalledTimes(1);
  });

  it('gives up and rethrows the transient error after exhausting attempts', async () => {
    // Queue exactly `attempts` transient rejections (same per-call style as the
    // succeed-after-retry test) so the function consumes all of them and gives up.
    renameMock
      .mockRejectedValueOnce(errno('EPERM'))
      .mockRejectedValueOnce(errno('EPERM'))
      .mockRejectedValueOnce(errno('EPERM'));
    await expect(renameWithRetry('a', 'b', { attempts: 3, delayMs: 0 })).rejects.toMatchObject({
      code: 'EPERM',
    });
    expect(renameMock).toHaveBeenCalledTimes(3);
  });
});
