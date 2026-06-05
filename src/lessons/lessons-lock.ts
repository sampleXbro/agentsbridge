/**
 * Process lock for lessons-graph writes.
 *
 * Multiple harnesses can call `agentsmesh lessons add` concurrently — capture
 * the rule once per failure, even when a hooked CI step and the user's editor
 * race for the same `lessons.json`. The lock lives at
 * `.agentsmesh/lessons/.lessons.lock` and reuses the same `acquireProcessLock`
 * primitive as `.install.lock` / `.generate.lock`, so stale-eviction, signal
 * cleanup, and PID metadata all behave identically.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  acquireProcessLock,
  type LockOptions,
  type LockRelease,
} from '../utils/filesystem/process-lock.js';

export const LESSONS_LOCK_FILENAME = '.lessons.lock';

export function lessonsLockPath(projectRoot: string): string {
  return resolve(projectRoot, '.agentsmesh/lessons', LESSONS_LOCK_FILENAME);
}

export async function acquireLessonsLock(
  projectRoot: string,
  opts: LockOptions = {},
): Promise<LockRelease> {
  const lockPath = lessonsLockPath(projectRoot);
  await mkdir(dirname(lockPath), { recursive: true });
  return acquireProcessLock(lockPath, opts);
}
