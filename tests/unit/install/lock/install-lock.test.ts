import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  acquireInstallLock,
  INSTALL_LOCK_FILENAME,
} from '../../../../src/install/lock/install-lock.js';
import { LockAcquisitionError } from '../../../../src/core/errors.js';

let canonicalDir = '';

beforeEach(() => {
  canonicalDir = join(tmpdir(), `am-install-lock-${randomBytes(8).toString('hex')}`);
  mkdirSync(canonicalDir, { recursive: true });
});

afterEach(() => {
  rmSync(canonicalDir, { recursive: true, force: true });
});

describe('acquireInstallLock', () => {
  it('exposes the canonical lock filename .install.lock', () => {
    expect(INSTALL_LOCK_FILENAME).toBe('.install.lock');
  });

  it('creates the lock directory inside canonicalDir on acquire', async () => {
    const release = await acquireInstallLock(canonicalDir);
    try {
      expect(existsSync(join(canonicalDir, INSTALL_LOCK_FILENAME))).toBe(true);
    } finally {
      await release();
    }
  });

  it('removes the lock directory on release', async () => {
    const release = await acquireInstallLock(canonicalDir);
    await release();
    expect(existsSync(join(canonicalDir, INSTALL_LOCK_FILENAME))).toBe(false);
  });

  it('release is idempotent', async () => {
    const release = await acquireInstallLock(canonicalDir);
    await release();
    await release(); // second call must not throw
    expect(existsSync(join(canonicalDir, INSTALL_LOCK_FILENAME))).toBe(false);
  });

  it('fails fast when lock is already held by another acquire', async () => {
    const firstRelease = await acquireInstallLock(canonicalDir);
    try {
      // retries=0 makes the second acquire fail immediately instead of waiting.
      await expect(
        acquireInstallLock(canonicalDir, { retries: 0, retryDelayMs: 1 }),
      ).rejects.toThrow(LockAcquisitionError);
    } finally {
      await firstRelease();
    }
  });

  it('re-acquires after release', async () => {
    const first = await acquireInstallLock(canonicalDir);
    await first();
    const second = await acquireInstallLock(canonicalDir);
    try {
      expect(existsSync(join(canonicalDir, INSTALL_LOCK_FILENAME))).toBe(true);
    } finally {
      await second();
    }
  });

  it('honors retries option to wait briefly before failing', async () => {
    const first = await acquireInstallLock(canonicalDir);
    const start = Date.now();
    try {
      await expect(
        acquireInstallLock(canonicalDir, { retries: 2, retryDelayMs: 50 }),
      ).rejects.toThrow(LockAcquisitionError);
    } finally {
      await first();
    }
    const elapsed = Date.now() - start;
    // 2 retries * 50ms = at least ~100ms before throwing
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });
});
