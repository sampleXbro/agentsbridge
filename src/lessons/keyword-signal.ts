import { tokenize } from './ranking-text.js';

/**
 * Keyword-trigger "signal" guard shared by capture guardrails and `validate`.
 *
 * A keyword trigger fires ONLY when its full pattern is a substring of an
 * explicit `--keyword`, OR its tokens appear as a CONTIGUOUS run in the
 * `--file`/`--cmd` tokens (see keyword-match.ts). The needle that must match is
 * exactly {@link tokenize}(pattern), so the more tokens a pattern carries the
 * less likely either path matches — a long descriptive pattern (a sentence of
 * keywords) is effectively dead: it is never a substring of a realistic
 * `--keyword` and never appears contiguously in a file path. Authors should use
 * a short distinctive phrase instead.
 */

/** Soft cap on keyword-trigger token count; past this, recall rarely matches. */
export const MAX_RECOMMENDED_KEYWORD_TOKENS = 5;

/** True when a keyword pattern carries more matchable tokens than recall can realistically hit. */
export function isLowSignalKeyword(pattern: string): boolean {
  return tokenize(pattern).length > MAX_RECOMMENDED_KEYWORD_TOKENS;
}

/** Lowercase alphanumeric tokens, order-preserving, UNFILTERED — mirrors the recall haystack. */
function splitRawTokens(pattern: string): string[] {
  return pattern
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * True when the pattern's stopword-FILTERED needle differs from its raw token
 * run — i.e. the multi-word phrase contains a stopword/short token. The recall
 * haystack keeps stopwords, so such a needle can never appear as a contiguous
 * run in text containing the literal phrase ("state of the art" → needle
 * `[state, art]` never matches `[state, of, the, art]`): the trigger is
 * structurally unmatchable on the `--file`/`--cmd` path.
 */
export function keywordNeedleLosesTokens(pattern: string): boolean {
  const raw = splitRawTokens(pattern);
  if (raw.length < 2) return false; // single-word patterns can't have a gap
  return tokenize(pattern).length !== raw.length;
}
