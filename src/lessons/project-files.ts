import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toRelPath } from './paths.js';

/**
 * Directories never worth walking for the trigger-liveness file list: the huge,
 * non-source ones. Note `dist`/`coverage`/build outputs are deliberately KEPT —
 * "dead" means a glob matches NO file on disk (a rename casualty), so a glob over
 * a present-but-gitignored build artifact must read as LIVE, not dead.
 */
const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** Safety bound on the walk so a pathological tree can't run away. */
const MAX_FILES = 200_000;

/**
 * The on-disk file list (project-relative, forward-slash) used by the
 * dead-`file_glob` liveness check — or `null` when it cannot be read, so the
 * caller SKIPS the check rather than flagging every glob dead.
 *
 * Liveness is "matches a file that exists", so this walks the working tree by
 * existence (NOT by git tracking): a glob over a present-but-gitignored file
 * (e.g. a build output) is live, and only a path that no longer exists on disk
 * — a rename casualty — is dead. Skips `.git`/`node_modules` for sanity. Never
 * throws. Not on the recall hot path (only `validate`/`lint`/`prune` call it).
 */
export function listProjectFiles(projectRoot: string): Set<string> | null {
  const out = new Set<string>();
  try {
    const stack = [projectRoot];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) stack.push(join(dir, entry.name));
        } else if (entry.isFile()) {
          out.add(toRelPath(projectRoot, join(dir, entry.name)));
          if (out.size > MAX_FILES) return out;
        }
      }
    }
  } catch {
    return null;
  }
  return out;
}
