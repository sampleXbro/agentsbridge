/**
 * Codex's real path-scoped instruction mechanism is nested per-directory
 * `AGENTS.md` / `AGENTS.override.md` files, walked from the project root down
 * to the current working directory (see
 * https://developers.openai.com/codex/guides/agents-md and
 * docs/agent-structures/codex-cli-project-level-advanced.md §2.1, §6.2, §11).
 * `{dir}` is derived from the first glob with a usable directory prefix; when
 * no glob yields one (no globs, a root-wildcard glob, or an ambiguous/unsafe
 * glob), the rule's own slug is used as the directory name instead.
 */

import { basename } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';

function ruleSlug(source: string): string {
  return basename(source, '.md');
}

/** A single path segment containing a glob metacharacter. */
const GLOB_METACHAR = /[*?[\]]/;

/**
 * Directory prefix of one glob, or `null` when the glob has no safe, usable
 * directory prefix (empty, absolute, traversal, brace-ambiguous, or no
 * non-wildcard leading segment).
 */
function directoryFromGlob(glob: string): string | null {
  let normalized = glob.trim();
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('..')) return null;
  if (normalized.includes('{')) return null; // brace expansion is ambiguous for a single directory

  const segments = normalized.split('/');
  const dirSegments: string[] = [];
  for (const segment of segments) {
    if (GLOB_METACHAR.test(segment)) break;
    dirSegments.push(segment);
  }
  if (dirSegments.length === 0) return null;
  // Glob had no wildcard segment at all (a literal path) — treat the last
  // segment as the file-ish leaf and use its parent as the directory.
  if (dirSegments.length === segments.length) dirSegments.pop();
  return dirSegments.length > 0 ? dirSegments.join('/') : null;
}

/** Directory a scoped rule nests under: first glob with a usable prefix, else the rule's slug. */
export function codexRuleDirectory(rule: Pick<CanonicalRule, 'source' | 'globs'>): string {
  for (const glob of rule.globs) {
    const dir = directoryFromGlob(glob);
    if (dir) return dir;
  }
  return ruleSlug(rule.source);
}

/** Nested `AGENTS.md` (or `AGENTS.override.md`) path Codex's directory walk actually loads. */
export function codexNestedAgentsPath(
  rule: Pick<CanonicalRule, 'source' | 'globs' | 'codexInstructionVariant'>,
): string {
  const dir = codexRuleDirectory(rule);
  const filename = rule.codexInstructionVariant === 'override' ? 'AGENTS.override.md' : 'AGENTS.md';
  return `${dir}/${filename}`;
}
