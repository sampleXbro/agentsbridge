import type { LessonsQuery } from './query.js';
import { tokenize } from './ranking-text.js';

/**
 * Keyword-trigger matching. Mandatory recall fires on `--file`/`--cmd`, but a
 * `keyword` trigger historically only tested the explicit `--keyword` — so a
 * keyword-only (conceptual) lesson never surfaced unless the agent hand-crafted
 * `--keyword`, the least reliable input. This closes that gap WITHOUT touching
 * the graph: a keyword trigger also matches when its tokens appear as a
 * contiguous run in the file-path + command tokens the recall already carries.
 *
 * Matching is on token boundaries — NOT substring — so "cat" cannot fire on
 * "category" and a multi-word pattern must appear adjacently. The PATTERN is run
 * through the shared {@link tokenize} (lowercase, split on non-alphanumerics,
 * drop <2-char tokens and stopwords), so a degenerate pattern like "a" or "the"
 * tokenizes to nothing and never matches. The HAYSTACK is split but NOT filtered,
 * so its stopwords still separate words — "read only" must not match the
 * non-adjacent "read the only".
 */

/** Lowercase alphanumeric tokens, order-preserving and UNFILTERED (keeps stopwords). */
function splitTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** Tokens implied by the current edit/command — the recall's task context. */
function deriveHaystackTokens(query: LessonsQuery): string[] {
  const parts: string[] = [];
  if (query.file !== undefined) parts.push(query.file);
  if (query.command !== undefined) parts.push(query.command);
  return parts.length === 0 ? [] : splitTokens(parts.join(' '));
}

/** True when `needle` appears as a contiguous run inside `hay`. */
function containsRun(needle: readonly string[], hay: readonly string[]): boolean {
  if (needle.length === 0) return false; // empty needle must never match
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    let hit = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (hay[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

export function keywordMatches(pattern: string, query: LessonsQuery): boolean {
  // 1. Explicit --keyword: byte-identical to the original substring behavior.
  if (query.keyword !== undefined && query.keyword.toLowerCase().includes(pattern.toLowerCase())) {
    return true;
  }
  // 2. Derived from file + command, on token boundaries.
  return containsRun(tokenize(pattern), deriveHaystackTokens(query));
}
