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
