import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  acquireProcessLock,
  type LockRelease,
} from '../../../src/utils/filesystem/process-lock.js';
import { LockAcquisitionError } from '../../../src/core/errors.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-test-process-lock');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('acquireProcessLock', () => {
  it('acquires an uncontended lock and cleans up on release', async () => {
    const lockPath = join(TEST_DIR, 'a', '.generate.lock');
    const release = await acquireProcessLock(lockPath);
    expect(existsSync(lockPath)).toBe(true);
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it('serializes contended acquires — second waits until first releases', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');

    const first = await acquireProcessLock(lockPath);
    let secondAcquired = false;
    const secondPromise = acquireProcessLock(lockPath, {
      retries: 50,
      retryDelayMs: 10,
    }).then((rel) => {
      secondAcquired = true;
      return rel;
    });

    // Give the second acquire time to attempt and block.
    await new Promise((r) => setTimeout(r, 60));
    expect(secondAcquired).toBe(false);

    await first();
    const second = await secondPromise;
    expect(secondAcquired).toBe(true);
    await second();
  });

  it('throws LockAcquisitionError after exhausting retries when holder is live', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const first = await acquireProcessLock(lockPath);
    try {
      await expect(
        acquireProcessLock(lockPath, { retries: 2, retryDelayMs: 5, staleMs: 60_000 }),
      ).rejects.toBeInstanceOf(LockAcquisitionError);
    } finally {
      await first();
    }
  });

  it('evicts a stale lock (age > staleMs) and acquires it', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(
      join(lockPath, 'holder.json'),
      JSON.stringify({ pid: process.pid, started: Date.now() - 120_000, hostname: 'irrelevant' }),
    );

    const release = await acquireProcessLock(lockPath, {
      retries: 0,
      retryDelayMs: 5,
      staleMs: 60_000,
    });
    expect(existsSync(lockPath)).toBe(true);
    await release();
  });

  it('evicts a lock whose PID is no longer running (same host)', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const { hostname } = await import('node:os');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(
      join(lockPath, 'holder.json'),
      // PID 0 is never a live user process; treated as dead.
      JSON.stringify({ pid: 0, started: Date.now(), hostname: hostname() }),
    );

    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    expect(existsSync(lockPath)).toBe(true);
    await release();
  });

  it('release is idempotent', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const release: LockRelease = await acquireProcessLock(lockPath);
    await release();
    await release(); // must not throw
    expect(existsSync(lockPath)).toBe(false);
  });

  it('treats unreadable lock metadata as stale', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    // No holder.json file — unreadable metadata is treated as stale.
    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
  });
});
