import { join } from 'node:path';
import { readFileSafe, writeFileAtomic } from './fs.js';

/**
 * Append entries to a project's `.gitattributes` unless already present. Returns
 * true when the file was modified, false when every entry was already there.
 * Idempotent: safe to call on each re-run. Unlike `.gitignore`, attribute lines
 * have no ancestor coverage, so matching is exact-line only (after trim); comment
 * and blank lines are ignored, and existing content plus its trailing newline are
 * preserved.
 */
export async function ensureGitattributesEntries(
  projectRoot: string,
  entries: readonly string[],
): Promise<boolean> {
  const path = join(projectRoot, '.gitattributes');
  const current = (await readFileSafe(path)) ?? '';
  const existing = new Set(
    current
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#')),
  );
  const toAdd = entries.filter((e) => !existing.has(e.trim()));
  if (toAdd.length === 0) return false;
  const suffix = current.endsWith('\n') || current === '' ? '' : '\n';
  await writeFileAtomic(path, current + suffix + toAdd.join('\n') + '\n');
  return true;
}
