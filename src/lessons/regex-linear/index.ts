/**
 * Linear-time matcher for `command_pattern` triggers — an in-repo, dependency-free
 * non-backtracking regex engine (Thompson NFA). Recall executes author-supplied
 * patterns against the command string on a mandatory hot path; a backtracking
 * `RegExp` can be driven super-linear (`(a+)+`, `a+a+`, even `a+b` is quadratic
 * on a long non-matching input), so command patterns run here instead, where
 * matching is provably linear in the input length for any compilable pattern.
 *
 * `compileLinearMatcher` returns null for patterns the linear engine cannot
 * evaluate — invalid syntax, backreferences, or lookarounds — so callers fail
 * closed: validation rejects them (UNSAFE_TRIGGER_PATTERN) and recall skips them.
 */

import { buildMatcher, type LinearMatcher } from './nfa.js';
import { parseRegex } from './parse.js';

export type { LinearMatcher } from './nfa.js';

const cache = new Map<string, LinearMatcher | null>();

export function compileLinearMatcher(pattern: string): LinearMatcher | null {
  const hit = cache.get(pattern);
  if (hit !== undefined || cache.has(pattern)) return hit ?? null;
  let matcher: LinearMatcher | null;
  try {
    matcher = buildMatcher(parseRegex(pattern));
  } catch {
    matcher = null; // unsupported construct or invalid syntax → fail closed
  }
  cache.set(pattern, matcher);
  return matcher;
}
