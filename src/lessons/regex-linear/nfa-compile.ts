/** Thompson NFA construction: compile an {@link AstNode} tree to an ε-NFA. */

import type { AstNode } from './ast.js';

export type AssertKind = 'start' | 'end' | 'wordB' | 'nonWordB';

export interface State {
  eps: number[];
  asserts: { kind: AssertKind; target: number }[];
  chars: { test: (c: string) => boolean; target: number }[];
}

export interface CompiledNfa {
  readonly states: State[];
  readonly start: number;
  readonly accept: number;
}

/**
 * Cap on compiled NFA states. A short pattern can still expand to a huge NFA via
 * counted repetition (`a{1000}` ≈ 2000 states, `a{1000}` ×10 ≈ 20000). This
 * bounds COMPILE memory; `alloc` throws once exceeded and the pattern is rejected
 * (UNSAFE). Match TIME is bounded separately by the work budget. Real command
 * patterns are tiny (< 200 states).
 */
const MAX_NFA_STATES = 2000;

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

/** `.` matches any char EXCEPT a line terminator (JS without the `s`/dotAll flag). */
function isNonLineTerminator(c: string): boolean {
  return c !== '\n' && c !== '\r' && c !== '\u2028' && c !== '\u2029';
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
            ? isNonLineTerminator
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

export function compileNfa(ast: AstNode): CompiledNfa {
  const b = new Builder();
  const { start, end } = compileNode(b, ast);
  return { states: b.states, start, accept: end };
}
