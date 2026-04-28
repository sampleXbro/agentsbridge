/**
 * Edge-case coverage for `acquireProcessLock` that the main suite does not
 * exercise. These tests pin branches that matter when teams hit weird states:
 *  - holder.json is malformed (invalid JSON, non-object, missing fields)
 *  - hostname mismatch keeps a remote-host lock alive (cannot probe its PID)
 *  - retries=0 path (immediate failure / immediate success)
 *  - parent directory does not exist (acquireProcessLock auto-creates it)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireProcessLock } from '../../../src/utils/filesystem/process-lock.js';
import { LockAcquisitionError } from '../../../src/core/errors.js';

const TEST_DIR = join(tmpdir(), `am-lock-edge-${process.pid}`);

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('acquireProcessLock — corrupted holder.json', () => {
  it('treats holder.json with invalid JSON as orphaned and evicts it once aged', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(join(lockPath, 'holder.json'), '{not valid json');
    // Age the dir past the young grace window so the missing-metadata path triggers eviction.
    const aged = new Date(Date.now() - 10_000);
    utimesSync(lockPath, aged, aged);

    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
  });

  it('treats holder.json containing a non-object (string) as orphaned and evicts it once aged', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(join(lockPath, 'holder.json'), '"just a string"');
    const aged = new Date(Date.now() - 10_000);
    utimesSync(lockPath, aged, aged);

    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
  });

  it('treats holder.json missing the required fields (pid/started) as orphaned once aged', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(join(lockPath, 'holder.json'), JSON.stringify({ note: 'no pid' }));
    const aged = new Date(Date.now() - 10_000);
    utimesSync(lockPath, aged, aged);

    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    await release();
  });
});

describe('acquireProcessLock — hostname mismatch keeps lock alive', () => {
  it('does NOT evict a fresh lock held by a different host (cannot probe remote PID)', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(
      join(lockPath, 'holder.json'),
      JSON.stringify({
        pid: 99999,
        started: Date.now(),
        hostname: 'definitely-not-this-host',
      }),
    );

    await expect(
      acquireProcessLock(lockPath, { retries: 1, retryDelayMs: 5, staleMs: 60_000 }),
    ).rejects.toBeInstanceOf(LockAcquisitionError);
    // Lock dir must still exist — we did not evict the remote host's hold.
    expect(existsSync(lockPath)).toBe(true);
  });

  it('DOES evict a lock from a different host after staleMs elapses', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(
      join(lockPath, 'holder.json'),
      JSON.stringify({
        pid: 99999,
        started: Date.now() - 120_000,
        hostname: 'definitely-not-this-host',
      }),
    );

    const release = await acquireProcessLock(lockPath, {
      retries: 0,
      retryDelayMs: 5,
      staleMs: 60_000,
    });
    expect(existsSync(lockPath)).toBe(true);
    await release();
  });
});

describe('acquireProcessLock — retries=0 boundary', () => {
  it('with retries=0, succeeds on the first uncontended attempt', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const release = await acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5 });
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
  });

  it('with retries=0 and a held live lock, throws immediately without waiting', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const first = await acquireProcessLock(lockPath);
    try {
      await expect(
        acquireProcessLock(lockPath, { retries: 0, retryDelayMs: 5, staleMs: 60_000 }),
      ).rejects.toBeInstanceOf(LockAcquisitionError);
    } finally {
      await first();
    }
  });
});

describe('acquireProcessLock — parent directory creation', () => {
  it('auto-creates missing parent directories (recursive mkdir)', async () => {
    const lockPath = join(TEST_DIR, 'a', 'deeply', 'nested', '.generate.lock');
    expect(existsSync(join(TEST_DIR, 'a'))).toBe(false);

    const release = await acquireProcessLock(lockPath);
    expect(existsSync(lockPath)).toBe(true);
    expect(existsSync(join(lockPath, 'holder.json'))).toBe(true);
    await release();
    expect(existsSync(lockPath)).toBe(false);
    // Parent dirs left behind on release — that is the documented behavior.
    expect(existsSync(join(TEST_DIR, 'a', 'deeply', 'nested'))).toBe(true);
  });
});

describe('acquireProcessLock — release semantics', () => {
  it('release does not throw when the lock dir was already removed externally', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const release = await acquireProcessLock(lockPath);
    rmSync(lockPath, { recursive: true, force: true });
    // Must be tolerant of external cleanup (rm errors are swallowed via .catch()).
    await expect(release()).resolves.toBeUndefined();
  });

  it('writes a holder.json containing the current process PID', async () => {
    const lockPath = join(TEST_DIR, '.generate.lock');
    const release = await acquireProcessLock(lockPath);
    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(lockPath, 'holder.json'), 'utf-8'),
    );
    const parsed = JSON.parse(raw) as { pid: number; started: number; hostname?: string };
    expect(parsed.pid).toBe(process.pid);
    expect(typeof parsed.started).toBe('number');
    expect(parsed.started).toBeLessThanOrEqual(Date.now());
    await release();
  });
});
