import { join } from 'node:path';
import { readFileSafe, writeFileAtomic } from './fs.js';

/**
 * Append entries to a project's `.gitignore` unless an existing line already
 * covers them. Returns true when the file was modified, false when every entry
 * was already present (or covered). Idempotent: safe to call on each re-run.
 *
 * Coverage rules: an existing line covers a candidate when it is the same
 * string (after trim) or a broader pattern that ignores the candidate's parent
 * directory (e.g. `.agentsmesh/` covers `.agentsmesh/lessons/recall-log.jsonl`).
 * This keeps redundant child entries out when users already gitignore the whole
 * canonical tree. Comment and blank lines are ignored when matching.
 */
export async function ensureGitignoreEntries(
  projectRoot: string,
  entries: readonly string[],
): Promise<boolean> {
  const gitignorePath = join(projectRoot, '.gitignore');
  const current = (await readFileSafe(gitignorePath)) ?? '';
  const existing = new Set(
    current
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#')),
  );
  const toAdd = entries.filter((e) => !isCoveredByExisting(e, existing));
  if (toAdd.length === 0) return false;
  const suffix = current.endsWith('\n') || current === '' ? '' : '\n';
  await writeFileAtomic(gitignorePath, current + suffix + toAdd.join('\n') + '\n');
  return true;
}

/**
 * True when `existing` already ignores `candidate` — either the exact line or a
 * broader ancestor-directory pattern (`.agentsmesh`, `.agentsmesh/`, or
 * `.agentsmesh/**`).
 */
function isCoveredByExisting(candidate: string, existing: ReadonlySet<string>): boolean {
  if (existing.has(candidate)) return true;
  let parent = candidate.replace(/\/$/, '');
  while (parent.includes('/')) {
    parent = parent.slice(0, parent.lastIndexOf('/'));
    if (parent === '') break;
    if (existing.has(parent) || existing.has(`${parent}/`) || existing.has(`${parent}/**`)) {
      return true;
    }
  }
  return false;
}
