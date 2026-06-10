import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toRelPath } from './paths.js';

/** Directories never worth walking for the trigger-liveness file list. */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.next',
  'build',
  '.turbo',
]);

/** Safety bound on the fallback walk so a pathological tree can't run away. */
const MAX_FILES = 100_000;

/**
 * The working-tree file list (project-relative, forward-slash) used by the
 * dead-`file_glob` liveness check — or `null` when it cannot be determined, so
 * the caller SKIPS the check rather than flagging every glob dead.
 *
 * Prefers `git ls-files` (tracked + untracked-but-unignored, so a brand-new
 * file an agent just created still counts and a stale glob over a deleted path
 * is correctly dead). Falls back to a bounded directory walk outside a git repo.
 * Never throws.
 */
export function listProjectFiles(projectRoot: string): Set<string> | null {
  const git = spawnSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (git.error === undefined && git.status === 0) {
    const set = new Set<string>();
    for (const line of git.stdout.split('\n')) {
      const p = line.trim();
      if (p.length > 0) set.add(p.replaceAll('\\', '/'));
    }
    return set;
  }
  return walkFallback(projectRoot);
}

function walkFallback(projectRoot: string): Set<string> | null {
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
