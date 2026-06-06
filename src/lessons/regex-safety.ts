/**
 * ReDoS guard for `command_pattern` triggers — FAIL CLOSED.
 *
 * Recall is mandatory (it runs before every edit/command) and executes
 * lesson-author-supplied regexes against the command string. Any
 * catastrophic-backtracking pattern — nested repetition `(a+)+`, overlapping
 * quantified alternation `(a|aa)+`, adjacent repetition `a+a+` — can hang
 * `RegExp.test` on a short input, so one malicious/careless lesson could halt
 * agent workflows.
 *
 * A heuristic "detect the unsafe shapes" approach fails open: every such
 * detector has bypasses. So {@link isSafeRegexPattern} instead ACCEPTS ONLY a
 * provably-linear subset and rejects everything else (unknown constructions are
 * treated as unsafe, not safe). A pattern is accepted iff it contains none of:
 *   - a repeating quantifier (`*`, `+`, `{…}`) applied to a group — `(…)+`;
 *   - two repeating-quantified atoms in sequence (transparent across group
 *     delimiters, zero-width anchors, and optional atoms) — `a+a+`, `(a+)(a+)`,
 *     `a+b?a+`, `.*.*`;
 *   - a backreference (`\1`, `\k<name>`) or lookaround (`(?=`, `(?!`, `(?<=`,
 *     `(?<!`) — backtracking features RE2-class engines forbid.
 * Such patterns have no compounding ambiguity, so a single backtracking engine
 * pass is linear in the input. Linear patterns (`.*`, `https?://`, `(npm|pnpm)`,
 * `.*foo.*`, `rg.*a|rg.*b`) are accepted; provably-safe-but-unrecognized shapes
 * (e.g. `(?:abc)+`) are conservatively rejected.
 *
 * Validation rejects non-accepted patterns at capture (UNSAFE_TRIGGER_PATTERN);
 * recall skips them ({@link getSafeCommandRegex} returns null) — never executing
 * a pattern outside the linear subset.
 */

/** Patterns longer than this are treated as unsafe outright (defensive bound). */
const MAX_PATTERN_LENGTH = 1000;

interface Quant {
  readonly len: number;
  /** A quantifier that can match its atom 2+ times (`*`, `+`, `{…}`); `?` is not. */
  readonly repeating: boolean;
}

/** Classify the quantifier at index `j`; null when there is none / a literal brace. */
function quantAt(p: string, j: number): Quant | null {
  const c = p[j];
  if (c === '*' || c === '+') return { len: p[j + 1] === '?' ? 2 : 1, repeating: true };
  if (c === '?') return { len: p[j + 1] === '?' ? 2 : 1, repeating: false };
  if (c === '{') {
    const m = /^\{\d+(,\d*)?\}/.exec(p.slice(j));
    if (m === null) return null; // literal '{' — not a quantifier
    return { len: m[0].length + (p[j + m[0].length] === '?' ? 1 : 0), repeating: true };
  }
  return null;
}

/** Skip a `(` group-prefix; returns [newIndex, isLookaround]. `(?:`/`(?<name>` are fine. */
function classifyGroupOpen(p: string, i: number): { next: number; lookaround: boolean } {
  // i points at '('. Lookahead: (?= (?! ; lookbehind: (?<= (?<!
  if (p[i + 1] === '?') {
    const c2 = p[i + 2];
    if (c2 === '=' || c2 === '!') return { next: i + 3, lookaround: true };
    if (c2 === '<' && (p[i + 3] === '=' || p[i + 3] === '!'))
      return { next: i + 4, lookaround: true };
    if (c2 === ':') return { next: i + 3, lookaround: false }; // non-capturing
    if (c2 === '<') {
      // named group (?<name> — skip to '>'
      let j = i + 3;
      while (j < p.length && p[j] !== '>') j += 1;
      return { next: j + 1, lookaround: false };
    }
  }
  return { next: i + 1, lookaround: false };
}

/**
 * True when `pattern` is in the provably-linear subset safe to execute against
 * untrusted input. See module docs. Conservative: returns false for anything it
 * does not positively recognize as linear.
 */
export function isSafeRegexPattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH) return false;

  const n = pattern.length;
  let i = 0;
  // True when the most recent matching atom carried a repeating quantifier and
  // nothing input-consuming has happened since (group delimiters, zero-width
  // anchors, and optional atoms are transparent; a required atom or `|` resets).
  let prevRepeating = false;

  while (i < n) {
    const c = pattern[i];

    if (c === '\\') {
      const nxt = pattern[i + 1];
      if (nxt !== undefined && /[1-9]/.test(nxt)) return false; // backreference
      if (nxt === 'k') return false; // named backreference
      i += 2; // escaped atom (\d, \w, \., …) — consumes input
      const q = quantAt(pattern, i);
      if (q?.repeating === true && prevRepeating) return false;
      if (q !== null) i += q.len;
      prevRepeating = nextPrev(prevRepeating, q);
      continue;
    }

    if (c === '(') {
      const { next, lookaround } = classifyGroupOpen(pattern, i);
      if (lookaround) return false;
      i = next; // group open is transparent for adjacency
      continue;
    }

    if (c === ')') {
      i += 1;
      const q = quantAt(pattern, i);
      if (q?.repeating === true) return false; // quantified (repeating) group
      if (q !== null) i += q.len; // a `?`-optional group is transparent
      continue; // ')' is transparent
    }

    if (c === '[') {
      i += 1;
      while (i < n && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1;
      i += 1; // consume ']'
      const q = quantAt(pattern, i);
      if (q?.repeating === true && prevRepeating) return false;
      if (q !== null) i += q.len;
      prevRepeating = nextPrev(prevRepeating, q);
      continue;
    }

    if (c === '|') {
      prevRepeating = false; // new alternation branch
      i += 1;
      continue;
    }

    if (c === '^' || c === '$') {
      i += 1; // zero-width anchor — transparent
      continue;
    }

    // ordinary character atom
    i += 1;
    const q = quantAt(pattern, i);
    if (q?.repeating === true && prevRepeating) return false;
    if (q !== null) i += q.len;
    prevRepeating = nextPrev(prevRepeating, q);
  }

  return true;
}

/**
 * Adjacency state after an atom with quantifier `q`:
 *  - repeating quantifier → this atom repeats: mark true (and the caller already
 *    rejected if the prior atom also repeated);
 *  - optional `?` → transparent (atom may be empty): keep the prior state;
 *  - no quantifier → required atom consumes input: reset to false.
 */
function nextPrev(prev: boolean, q: Quant | null): boolean {
  if (q === null) return false; // required atom breaks adjacency
  if (q.repeating) return true;
  return prev; // optional atom is transparent
}

/**
 * Compile a `command_pattern` for recall, returning the regex only when it is
 * both valid and in the provably-linear subset; otherwise null (recall treats
 * null as a non-match, never executing a pattern outside the subset). Memoized —
 * triggers are static across a process and recall runs on the hot path.
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
