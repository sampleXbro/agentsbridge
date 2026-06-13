import { rename } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

interface ErrnoLike {
  code?: string;
}

/**
 * Errors Windows raises when a just-written directory is briefly locked — by the
 * exited writer's lingering handle (e.g. `git clone`), an antivirus scan, or the
 * search indexer. A same-filesystem rename never produces these on POSIX.
 */
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY', 'EEXIST']);

export interface RenameRetryOptions {
  /** Total attempts before giving up (default 5). */
  readonly attempts?: number;
  /** Base backoff in ms; doubles each retry (default 50). */
  readonly delayMs?: number;
}

/**
 * `rename`, retried on the transient lock errors Windows raises right after a
 * child process writes the source tree (the cache-finalize rename in
 * `git-remote.ts` hits this directly after `git clone`). On POSIX it is a single
 * rename. A non-transient error throws immediately; the last transient error
 * throws after the final attempt so a genuine failure still surfaces.
 */
export async function renameWithRetry(
  from: string,
  to: string,
  options: RenameRetryOptions = {},
): Promise<void> {
  const attempts = options.attempts ?? 5;
  const delayMs = options.delayMs ?? 50;
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const code = (err as ErrnoLike).code;
      const transient = code !== undefined && TRANSIENT_RENAME_CODES.has(code);
      if (!transient || attempt >= attempts - 1) throw err;
      await sleep(delayMs * 2 ** attempt);
    }
  }
}
