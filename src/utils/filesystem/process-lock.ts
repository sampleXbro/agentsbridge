/**
 * Cross-platform process lock backed by an atomic mkdir.
 *
 * Acquire semantics: mkdir with no `recursive` option is atomic per POSIX and
 * returns EEXIST if the directory already exists. That makes it a reliable
 * cross-process mutex without any third-party dependency.
 *
 * Stale recovery: the holder writes its PID and start timestamp into the lock
 * dir. On contention we peek at the PID; if the process is gone or the lock is
 * older than `staleMs`, we evict it and retry.
 */

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { LockAcquisitionError } from '../../core/errors.js';

const DEFAULT_STALE_MS = 60_000;
const DEFAULT_RETRIES = 30;
const DEFAULT_RETRY_DELAY_MS = 200;

interface LockMetadata {
  pid: number;
  started: number;
  hostname?: string;
}

export interface LockOptions {
  /** Maximum retry attempts before throwing LockAcquisitionError. */
  retries?: number;
  /** Delay between retries in ms. */
  retryDelayMs?: number;
  /** Lock age beyond which an existing lock is treated as stale and evicted. */
  staleMs?: number;
}

export type LockRelease = () => Promise<void>;

/**
 * Acquire an exclusive process-level lock.
 *
 * @param lockPath - Absolute path where the lock directory will be created.
 * @param opts - Retry/stale tuning knobs.
 * @returns A release function; callers must invoke it in a `finally` block.
 * @throws {LockAcquisitionError} if the lock cannot be acquired within the retry budget.
 */
export async function acquireProcessLock(
  lockPath: string,
  opts: LockOptions = {},
): Promise<LockRelease> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const delay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const stale = opts.staleMs ?? DEFAULT_STALE_MS;

  await mkdir(dirname(lockPath), { recursive: true });

  let attempt = 0;
  while (true) {
    const acquired = await tryAcquire(lockPath);
    if (acquired) return acquired;

    const existing = await inspectLock(lockPath);
    if (isStale(existing, stale)) {
      await rm(lockPath, { recursive: true, force: true }).catch(() => {});
      // Stale eviction is bookkeeping, not a wait — try again without consuming retry budget.
      continue;
    }

    if (attempt >= retries) {
      throw new LockAcquisitionError(lockPath, describeHolder(existing));
    }
    attempt++;
    await sleep(delay);
  }
}

async function tryAcquire(lockPath: string): Promise<LockRelease | null> {
  try {
    await mkdir(lockPath, { recursive: false });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return null;
    throw err;
  }

  const metadataPath = join(lockPath, 'holder.json');
  const metadata: LockMetadata = {
    pid: process.pid,
    started: Date.now(),
    hostname: getHostname(),
  };
  await writeFile(metadataPath, JSON.stringify(metadata), 'utf-8');

  let released = false;
  const signalHandler = (): void => {
    if (released) return;
    released = true;
    try {
      rmSync(lockPath, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup on signal.
    }
  };
  process.once('SIGINT', signalHandler);
  process.once('SIGTERM', signalHandler);
  process.once('exit', signalHandler);

  return async () => {
    if (released) return;
    released = true;
    process.off('SIGINT', signalHandler);
    process.off('SIGTERM', signalHandler);
    process.off('exit', signalHandler);
    await rm(lockPath, { recursive: true, force: true }).catch(() => {});
  };
}

async function inspectLock(lockPath: string): Promise<LockMetadata | null> {
  try {
    const raw = await readFile(join(lockPath, 'holder.json'), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isLockMetadata(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isStale(meta: LockMetadata | null, staleMs: number): boolean {
  if (!meta) return true;
  const age = Date.now() - meta.started;
  if (age > staleMs) return true;
  if (meta.hostname && meta.hostname !== getHostname()) return false;
  return !isProcessAlive(meta.pid);
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process. EPERM = process exists but not ours (still alive).
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function describeHolder(meta: LockMetadata | null): string {
  if (!meta) return 'unknown (unreadable lock metadata)';
  const host = meta.hostname ? `${meta.hostname}:` : '';
  return `${host}pid ${meta.pid} (running ${Date.now() - meta.started}ms)`;
}

function isLockMetadata(value: unknown): value is LockMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.pid === 'number' && typeof v.started === 'number';
}

function getHostname(): string {
  return hostname();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
