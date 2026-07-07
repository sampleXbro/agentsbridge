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

/**
 * Tokens implied by the current edit/command — the recall's task context.
 *
 * Each identifier contributes BOTH its whole lowercased form AND its camelCase /
 * acronym sub-words. Retaining the whole token keeps this fully backward
 * compatible — every keyword trigger that matched before still matches — while the
 * sub-words give conceptual reach a compressed file path otherwise hides: `guard`
 * now reaches `useLeaveGuard`, `selector` reaches `InvoiceCompanySelector`. A
 * sub-word run follows its whole token, so a multi-word needle (`company selector`)
 * still matches as a contiguous run. UNFILTERED (stopwords kept) so "read only"
 * cannot match the non-adjacent "read the only".
 */
function deriveHaystackTokens(query: LessonsQuery): string[] {
  const parts: string[] = [];
  if (query.file !== undefined) parts.push(query.file);
  if (query.command !== undefined) parts.push(query.command);
  if (parts.length === 0) return [];
  const out: string[] = [];
  for (const raw of parts.join(' ').split(/[^A-Za-z0-9]+/)) {
    if (raw.length === 0) continue;
    out.push(raw.toLowerCase());
    const sub = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase / digit→Upper boundary
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ACRONYM→Word boundary
      .toLowerCase()
      .split(' ')
      .filter((t) => t.length > 0);
    if (sub.length > 1) out.push(...sub);
  }
  return out;
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
