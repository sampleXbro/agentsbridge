/**
 * Linear-time simulation of the compiled command_pattern NFA.
 *
 * Simulates the ε-NFA WITHOUT backtracking: the active state set is advanced one
 * input character at a time, so matching is O(input × states) regardless of the
 * pattern — no catastrophic backtracking is possible (a JS `RegExp` cannot give
 * this guarantee). Search is unanchored (like `RegExp.test`): a fresh start
 * thread is seeded at every position; `^`/`$`/`\b` are position-gated assertions.
 */

import type { AstNode } from './ast.js';
import { type AssertKind, compileNfa } from './nfa-compile.js';

/**
 * A shared, mutable work budget. `remaining` is decremented per unit of NFA work
 * (state visited / transition followed); when it reaches zero the matcher gives
 * up and reports a non-match. Pass ONE budget across all triggers in a single
 * recall so total work is bounded query-wide, not just per pattern.
 */
export interface WorkBudget {
  remaining: number;
}

export interface LinearMatcher {
  /**
   * True if the pattern matches anywhere in `input` (unanchored, like
   * RegExp.test). Decrements `budget` as it works; if the budget is exhausted it
   * returns false (a safe non-match — never a false positive, no invented input
   * endpoint). Without a budget it runs to completion.
   */
  test(input: string, budget?: WorkBudget): boolean;
}

function wordBoundary(input: string, pos: number): boolean {
  const before = pos > 0 && /[A-Za-z0-9_]/.test(input[pos - 1]!);
  const after = pos < input.length && /[A-Za-z0-9_]/.test(input[pos]!);
  return before !== after;
}

function assertHolds(kind: AssertKind, input: string, pos: number): boolean {
  switch (kind) {
    case 'start':
      return pos === 0;
    case 'end':
      return pos === input.length;
    case 'wordB':
      return wordBoundary(input, pos);
    case 'nonWordB':
      return !wordBoundary(input, pos);
  }
}

/** Build a {@link LinearMatcher} from an AST (compiles it, then simulates). */
export function buildMatcher(ast: AstNode): LinearMatcher {
  const { states, start, accept } = compileNfa(ast);

  // ε/assertion closure at boundary `pos`, accumulating reachable states into
  // `set`. ITERATIVE (explicit stack) — a recursive walk overflows the call
  // stack on long ε-chains (e.g. `(){1000}` expands to thousands of ε-links).
  // Decrements the work budget per state visited; stops early when exhausted.
  const closure = (
    set: Set<number>,
    idx: number,
    input: string,
    pos: number,
    budget: WorkBudget,
  ): void => {
    const stack = [idx];
    while (stack.length > 0) {
      if (budget.remaining <= 0) return;
      const cur = stack.pop()!;
      if (set.has(cur)) continue;
      set.add(cur);
      budget.remaining -= 1;
      for (const t of states[cur]!.eps) if (!set.has(t)) stack.push(t);
      for (const a of states[cur]!.asserts) {
        if (assertHolds(a.kind, input, pos) && !set.has(a.target)) stack.push(a.target);
      }
    }
  };

  return {
    // The input is matched in full (no truncation — truncation would miss suffix
    // matches and let `$` falsely match an invented endpoint). Work is bounded by
    // the shared budget instead: when it runs out we report a safe non-match.
    test(input: string, budget?: WorkBudget): boolean {
      const b: WorkBudget = budget ?? { remaining: Number.POSITIVE_INFINITY };
      if (b.remaining <= 0) return false;
      let current = new Set<number>();
      for (let pos = 0; pos <= input.length; pos += 1) {
        closure(current, start, input, pos, b); // unanchored: seed a start thread here
        if (current.has(accept)) return true;
        if (b.remaining <= 0) return false; // budget exhausted → safe non-match
        if (pos === input.length) break;
        const ch = input[pos]!;
        const next = new Set<number>();
        for (const s of current) {
          b.remaining -= 1;
          for (const t of states[s]!.chars) {
            if (t.test(ch)) closure(next, t.target, input, pos + 1, b);
          }
        }
        current = next;
      }
      return current.has(accept);
    },
  };
}
