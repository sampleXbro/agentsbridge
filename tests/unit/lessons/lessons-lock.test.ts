import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  acquireLessonsLock,
  lessonsLockPath,
  LESSONS_LOCK_FILENAME,
} from '../../../src/lessons/lessons-lock.js';
import { LockAcquisitionError } from '../../../src/core/errors.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = join(tmpdir(), `am-lessons-lock-${randomBytes(8).toString('hex')}`);
  mkdirSync(projectRoot, { recursive: true });
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('acquireLessonsLock', () => {
  it('exposes the canonical lock filename .lessons.lock', () => {
    expect(LESSONS_LOCK_FILENAME).toBe('.lessons.lock');
  });

  it('creates the lock directory at .agentsmesh/lessons/.lessons.lock on acquire', async () => {
    const release = await acquireLessonsLock(projectRoot);
    try {
      expect(existsSync(lessonsLockPath(projectRoot))).toBe(true);
    } finally {
      await release();
    }
  });

  it('removes the lock directory on release', async () => {
    const release = await acquireLessonsLock(projectRoot);
    await release();
    expect(existsSync(lessonsLockPath(projectRoot))).toBe(false);
  });

  it('reports "lessons lock" — not "generate lock" — when contended', async () => {
    const first = await acquireLessonsLock(projectRoot);
    try {
      const err = await acquireLessonsLock(projectRoot, { retries: 0, retryDelayMs: 1 }).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(LockAcquisitionError);
      expect((err as LockAcquisitionError).message).toContain('lessons lock');
      expect((err as LockAcquisitionError).message).not.toContain('generate lock');
      expect((err as LockAcquisitionError).label).toBe('lessons lock');
    } finally {
      await first();
    }
  });
});
