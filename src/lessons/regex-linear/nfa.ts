/**
 * Thompson NFA compile + linear-time simulation for the command_pattern matcher.
 *
 * Compiles the {@link AstNode} tree to an ε-NFA and simulates it WITHOUT
 * backtracking: the active state set is advanced one input character at a time,
 * so matching is O(input × states) regardless of the pattern — no catastrophic
 * backtracking is possible (that is the whole point; a JS `RegExp` cannot give
 * this guarantee). Search is unanchored (like `RegExp.test`): a fresh start
 * thread is seeded at every position; `^`/`$`/`\b` are position-gated assertions.
 */

import type { AstNode } from './parse.js';

type AssertKind = 'start' | 'end' | 'wordB' | 'nonWordB';

interface State {
  eps: number[];
  asserts: { kind: AssertKind; target: number }[];
  chars: { test: (c: string) => boolean; target: number }[];
}

export interface LinearMatcher {
  /** True if the pattern matches anywhere in `input` (unanchored, like RegExp.test). */
  test(input: string): boolean;
}

/**
 * Cap on compiled NFA states. A short pattern can still expand to a huge NFA via
 * counted repetition (`a{1000}` ≈ 2000 states, `a{1000}` ×10 ≈ 20000), and match
 * cost is O(states × input) — so bounding pattern *length* is not enough.
 * Builder.alloc throws once this is exceeded; the pattern is then rejected
 * (UNSAFE) rather than allowed to amplify recall work. Real command patterns are
 * tiny (< 200 states), so this only rejects pathological expansions.
 */
const MAX_NFA_STATES = 2000;

/** Cap on the input length matched against; longer input is truncated (bounds work). */
const MAX_MATCH_INPUT = 32_768;

class Builder {
  readonly states: State[] = [];
  alloc(): number {
    if (this.states.length >= MAX_NFA_STATES) {
      throw new Error(`NFA state limit exceeded (${MAX_NFA_STATES}); pattern expands too large`);
    }
    this.states.push({ eps: [], asserts: [], chars: [] });
    return this.states.length - 1;
  }
}

/** Compile an AST fragment, returning its [start, end] state indices (end has no outgoing). */
function compileNode(b: Builder, node: AstNode): { start: number; end: number } {
  switch (node.k) {
    case 'empty':
    case 'assert': {
      const s = b.alloc();
      const e = b.alloc();
      if (node.k === 'assert') b.states[s]!.asserts.push({ kind: node.kind, target: e });
      else b.states[s]!.eps.push(e);
      return { start: s, end: e };
    }
    case 'char':
    case 'any':
    case 'class': {
      const s = b.alloc();
      const e = b.alloc();
      const test =
        node.k === 'char'
          ? (c: string): boolean => c === node.ch
          : node.k === 'any'
            ? (c: string): boolean => c !== '\n'
            : node.test;
      b.states[s]!.chars.push({ test, target: e });
      return { start: s, end: e };
    }
    case 'concat': {
      if (node.items.length === 0) return compileNode(b, { k: 'empty' });
      let first: { start: number; end: number } | null = null;
      let prevEnd = -1;
      for (const item of node.items) {
        const frag = compileNode(b, item);
        if (first === null) first = frag;
        else b.states[prevEnd]!.eps.push(frag.start);
        prevEnd = frag.end;
      }
      return { start: first!.start, end: prevEnd };
    }
    case 'alt': {
      const s = b.alloc();
      const e = b.alloc();
      for (const opt of node.opts) {
        const frag = compileNode(b, opt);
        b.states[s]!.eps.push(frag.start);
        b.states[frag.end]!.eps.push(e);
      }
      return { start: s, end: e };
    }
    case 'opt': {
      const s = b.alloc();
      const e = b.alloc();
      const frag = compileNode(b, node.node);
      b.states[s]!.eps.push(frag.start, e);
      b.states[frag.end]!.eps.push(e);
      return { start: s, end: e };
    }
    case 'star': {
      const s = b.alloc();
      const e = b.alloc();
      const frag = compileNode(b, node.node);
      b.states[s]!.eps.push(frag.start, e);
      b.states[frag.end]!.eps.push(frag.start, e);
      return { start: s, end: e };
    }
    case 'plus': {
      const e = b.alloc();
      const frag = compileNode(b, node.node);
      b.states[frag.end]!.eps.push(frag.start, e);
      return { start: frag.start, end: e };
    }
  }
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

/** Build a {@link LinearMatcher} from a compiled NFA. */
export function buildMatcher(ast: AstNode): LinearMatcher {
  const b = new Builder();
  const { start, end } = compileNode(b, ast);
  const states = b.states;
  const accept = end;

  // ε/assertion closure at boundary `pos`, accumulating reachable states into
  // `set`. ITERATIVE (explicit stack) — a recursive walk overflows the call
  // stack on long ε-chains (e.g. `(){1000}` expands to thousands of ε-links).
  const closure = (set: Set<number>, idx: number, input: string, pos: number): void => {
    const stack = [idx];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (set.has(cur)) continue;
      set.add(cur);
      for (const t of states[cur]!.eps) if (!set.has(t)) stack.push(t);
      for (const a of states[cur]!.asserts) {
        if (assertHolds(a.kind, input, pos) && !set.has(a.target)) stack.push(a.target);
      }
    }
  };

  return {
    test(rawInput: string): boolean {
      // Bound the work: match cost is O(states × input); truncate pathologically
      // long input so a crafted pattern + huge command cannot exceed the budget.
      const input =
        rawInput.length > MAX_MATCH_INPUT ? rawInput.slice(0, MAX_MATCH_INPUT) : rawInput;
      let current = new Set<number>();
      for (let pos = 0; pos <= input.length; pos += 1) {
        closure(current, start, input, pos); // unanchored: seed a start thread here
        if (current.has(accept)) return true;
        if (pos === input.length) break;
        const ch = input[pos]!;
        const next = new Set<number>();
        for (const s of current) {
          for (const t of states[s]!.chars) {
            if (t.test(ch)) closure(next, t.target, input, pos + 1);
          }
        }
        current = next;
      }
      return current.has(accept);
    },
  };
}
