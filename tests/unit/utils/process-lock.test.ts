import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
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

  it('surfaces the provided label in the LockAcquisitionError message', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const first = await acquireProcessLock(lockPath);
    try {
      const err = await acquireProcessLock(lockPath, {
        retries: 0,
        retryDelayMs: 5,
        staleMs: 60_000,
        label: 'generate lock',
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LockAcquisitionError);
      expect((err as LockAcquisitionError).message).toContain('generate lock');
      expect((err as LockAcquisitionError).label).toBe('generate lock');
    } finally {
      await first();
    }
  });

  it('defaults the LockAcquisitionError label to a generic "lock" when none is given', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const first = await acquireProcessLock(lockPath);
    try {
      const err = await acquireProcessLock(lockPath, {
        retries: 0,
        retryDelayMs: 5,
        staleMs: 60_000,
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LockAcquisitionError);
      expect((err as LockAcquisitionError).label).toBe('lock');
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

  it('does NOT evict a long-running live holder on age alone (default staleMs)', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const { hostname } = await import('node:os');
    mkdirSync(lockPath, { recursive: true });
    // Two minutes old, but the holder is THIS process — still alive.
    writeFileSync(
      join(lockPath, 'holder.json'),
      JSON.stringify({ pid: process.pid, started: Date.now() - 120_000, hostname: hostname() }),
    );

    const err = await acquireProcessLock(lockPath, {
      retries: 0,
      retryDelayMs: 5,
      label: 'install lock',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LockAcquisitionError);
    expect((err as LockAcquisitionError).message).toContain('install lock');
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
  });

  it('evicts a live same-host holder only past the (hours-long) secondary age bound', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const { hostname } = await import('node:os');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(
      join(lockPath, 'holder.json'),
      JSON.stringify({
        pid: process.pid,
        started: Date.now() - 7 * 60 * 60 * 1000,
        hostname: hostname(),
      }),
    );

    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
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

  it('treats an aged orphaned lock dir (no holder.json) as stale and evicts it', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    // Age the lock dir past the young-lock grace window so it qualifies as orphaned.
    const aged = new Date(Date.now() - 10_000);
    utimesSync(lockPath, aged, aged);
    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
  });

  it('does NOT evict a young lock dir whose holder.json has not been written yet', async () => {
    // Reproduces the race that broke `generate-process-lock.integration.test.ts`:
    // process A succeeds at `mkdir(lockPath)` but has not yet `writeFile(holder.json)`,
    // and process B must NOT treat that brief window as a stale lock.
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    // No holder.json — but the dir was just created, so the lock is "young" and held.

    const acquireAttempt = acquireProcessLock(lockPath, {
      retries: 1,
      retryDelayMs: 20,
      staleMs: 60_000,
    });

    // Within the young grace window the lock dir must survive. Acquire must
    // exhaust its retries and reject — never evict the dir nor double-acquire.
    await expect(acquireAttempt).rejects.toBeInstanceOf(LockAcquisitionError);
    expect(existsSync(lockPath)).toBe(true);
  });
});

describe('acquireProcessLock — signal handling', () => {
  it('on SIGINT: removes the lock dir AND re-raises so the process terminates', async () => {
    const lockPath = join(TEST_DIR, '.signal.lock');
    await acquireProcessLock(lockPath);
    expect(existsSync(lockPath)).toBe(true);

    // Stub the re-raise so the test process survives; assert it was attempted —
    // without it, a registered listener suppresses the default terminate and the
    // critical section would keep running with its lock already removed.
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    try {
      process.emit('SIGINT', 'SIGINT');
      expect(existsSync(lockPath)).toBe(false);
      expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT');
    } finally {
      kill.mockRestore();
    }
  });
});
