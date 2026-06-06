/**
 * ReDoS guard for `command_pattern` triggers.
 *
 * Recall is mandatory (it runs before every edit/command), and it executes
 * lesson-author-supplied regexes against the command string. A catastrophic-
 * backtracking pattern such as `(a+)+$` can hang `RegExp.test` on a short
 * adversarial input, so one malicious/careless lesson could halt agent
 * workflows. We defend in depth:
 *   - validation rejects unsafe patterns at capture time (UNSAFE_TRIGGER_PATTERN)
 *   - recall skips unsafe patterns instead of executing them ({@link getSafeCommandRegex})
 *
 * {@link isSafeRegexPattern} implements the star-height heuristic (the same idea
 * as the `safe-regex` package) in-repo to avoid a runtime dependency on the
 * recall hot path: a repetition quantifier (`*`, `+`, `{n,}`, incl. lazy) applied
 * to a sub-expression that itself contains a repetition (star height ≥ 2, e.g.
 * `(a+)+`, `(\w+)*`, `([a-z]+)+`) is the construct that backtracks
 * exponentially. Linear patterns (`.*`, `https?://`, `(npm|pnpm)`, `(?:ab)+`)
 * are reported safe. The check is conservative: when it cannot positively prove
 * a nested repetition it reports safe, leaving genuinely-invalid regexes to the
 * separate validity gate.
 */

/** Patterns longer than this are treated as unsafe outright (defensive bound). */
const MAX_PATTERN_LENGTH = 1000;

interface Frame {
  /** Whether this group's body contains a repetition at any depth. */
  hasRep: boolean;
}

/** Classify the quantifier at index `j`; null when there is none / a literal brace. */
function quantAt(p: string, j: number): { len: number; isRep: boolean } | null {
  const c = p[j];
  if (c === '*' || c === '+') return { len: p[j + 1] === '?' ? 2 : 1, isRep: true };
  if (c === '?') return { len: p[j + 1] === '?' ? 2 : 1, isRep: false };
  if (c === '{') {
    const m = /^\{\d+(,\d*)?\}/.exec(p.slice(j));
    if (m === null) return null; // literal '{' — not a quantifier
    return { len: m[0].length + (p[j + m[0].length] === '?' ? 1 : 0), isRep: true };
  }
  return null;
}

/** Skip a `(` group-prefix (`?:`, `?=`, `?!`, `?<name>`, `?<=`, `?<!`); returns the new index. */
function skipGroupPrefix(p: string, i: number): number {
  if (p[i] !== '?') return i;
  i += 1;
  if (p[i] === ':' || p[i] === '=' || p[i] === '!') return i + 1;
  if (p[i] === '<') {
    i += 1;
    if (p[i] === '=' || p[i] === '!') return i + 1; // lookbehind
    while (i < p.length && p[i] !== '>') i += 1; // named group
    return i + 1;
  }
  return i;
}

/**
 * True when `pattern` is safe to execute against untrusted input — i.e. it has
 * no nested repetition (star height < 2). See module docs.
 */
export function isSafeRegexPattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH) return false;

  const stack: Frame[] = [{ hasRep: false }];
  let i = 0;
  const n = pattern.length;

  const markRep = (q: { isRep: boolean } | null): void => {
    if (q?.isRep === true) stack[stack.length - 1]!.hasRep = true;
  };

  while (i < n) {
    const c = pattern[i];
    if (c === '\\') {
      i += 2; // escaped atom
      const q = quantAt(pattern, i);
      markRep(q);
      if (q !== null) i += q.len;
      continue;
    }
    if (c === '[') {
      i += 1;
      while (i < n && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1;
      i += 1; // consume ']'
      const q = quantAt(pattern, i);
      markRep(q);
      if (q !== null) i += q.len;
      continue;
    }
    if (c === '(') {
      stack.push({ hasRep: false });
      i = skipGroupPrefix(pattern, i + 1);
      continue;
    }
    if (c === ')') {
      if (stack.length <= 1) {
        i += 1; // unbalanced — invalid regex; let the validity gate handle it
        continue;
      }
      const frame = stack.pop()!;
      i += 1;
      const q = quantAt(pattern, i);
      const followedByRep = q?.isRep === true;
      if (q !== null) i += q.len;
      // Repetition applied to a group whose body already repeats ⇒ star height ≥ 2.
      if (frame.hasRep && followedByRep) return false;
      // The group contributes a repetition to its parent's body when it is
      // repeated, or when its body repeats (so deeper nesting is detected).
      if (frame.hasRep || followedByRep) stack[stack.length - 1]!.hasRep = true;
      continue;
    }
    if (c === '|') {
      i += 1; // alternation is not a repetition signal
      continue;
    }
    i += 1; // ordinary atom (char, '.', '^', '$', …)
    const q = quantAt(pattern, i);
    markRep(q);
    if (q !== null) i += q.len;
  }

  return true;
}

/**
 * Compile a `command_pattern` for recall, returning the regex only when it is
 * both valid and ReDoS-safe; otherwise null (recall treats null as a non-match,
 * never executing an unsafe pattern). Results are memoized — triggers are static
 * across a process and recall runs on the hot path.
 */
const compileCache = new Map<string, RegExp | null>();

export function getSafeCommandRegex(pattern: string): RegExp | null {
  const cached = compileCache.get(pattern);
  if (cached !== undefined || compileCache.has(pattern)) return cached ?? null;
  let result: RegExp | null = null;
  if (isSafeRegexPattern(pattern)) {
    try {
      result = new RegExp(pattern);
    } catch {
      result = null;
    }
  }
  compileCache.set(pattern, result);
  return result;
}
