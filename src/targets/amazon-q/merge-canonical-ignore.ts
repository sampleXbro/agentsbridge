/**
 * Merge Amazon Q `deniedPaths` back into `.agentsmesh/ignore`.
 *
 * The generate direction is lossy: `deniedPaths` is a flat deny list, so comments and
 * gitignore re-inclusions (`!pattern`) never reach an agent JSON. Writing the imported
 * list over the canonical file would therefore delete them — and every other target
 * (claude-code, aider, cursor, ...) reads the same canonical file, so the loss spreads.
 *
 * The merge keeps every line Amazon Q cannot represent exactly where it was and treats
 * Q as authoritative only for the plain patterns it can carry.
 */

/** Comments, blank lines and negations have no `deniedPaths` representation. */
function isUnrepresentable(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!');
}

/**
 * @param existing - Current `.agentsmesh/ignore` content, or null when absent
 * @param imported - Plain deny patterns collected from the agent JSONs, first-seen order
 * @returns The canonical file content to write
 */
export function mergeCanonicalIgnore(existing: string | null, imported: readonly string[]): string {
  if (existing === null || existing.trim() === '') return imported.join('\n');

  const endsWithNewline = existing.endsWith('\n');
  const pending = new Set(imported);
  const lines: string[] = [];

  for (const line of existing.replace(/\n+$/, '').split(/\r?\n/)) {
    if (isUnrepresentable(line)) {
      lines.push(line);
      continue;
    }
    // Q owns plain patterns: keep the ones it still denies, drop the ones it removed.
    if (pending.delete(line.trim())) lines.push(line);
  }

  for (const pattern of imported) {
    if (pending.has(pattern)) lines.push(pattern);
  }

  return lines.join('\n') + (endsWithNewline ? '\n' : '');
}
