/**
 * Parser for the linear command_pattern matcher: regex source → AST. Supports
 * literals, escapes (`\d \w \s`, `\xHH`, `\uHHHH`, `\cX`, control chars), `.`,
 * char classes, anchors (`^ $ \b \B`), groups, `|`, and quantifiers (`* + ?`,
 * `{n,m}`, lazy). Throws {@link UnsupportedRegexError} for backreferences and
 * lookarounds (a non-backtracking engine cannot evaluate them); bounded `{n,m}`
 * is expanded at parse time with an upper bound to keep the NFA small.
 */

import { type AstNode, UnsupportedRegexError } from './ast.js';
import {
  classEscapeChar,
  escapeClass,
  escapeLiteral,
  expandRepeat,
  MAX_REPEAT,
  readControlEscape,
  readUnicodeEscape,
} from './parse-helpers.js';

export function parseRegex(src: string): AstNode {
  let i = 0;

  const peek = (): string | undefined => src[i];
  const eat = (): string => src[i++]!;

  function parseAlt(): AstNode {
    const opts = [parseConcat()];
    while (peek() === '|') {
      i += 1;
      opts.push(parseConcat());
    }
    return opts.length === 1 ? opts[0]! : { k: 'alt', opts };
  }

  function parseConcat(): AstNode {
    const items: AstNode[] = [];
    while (i < src.length && peek() !== '|' && peek() !== ')') {
      items.push(parseQuantified());
    }
    if (items.length === 0) return { k: 'empty' };
    return items.length === 1 ? items[0]! : { k: 'concat', items };
  }

  function parseQuantified(): AstNode {
    const atom = parseAtom();
    const q = peek();
    if (q === '*' || q === '+' || q === '?') {
      i += 1;
      if (peek() === '?') i += 1; // lazy — same match-existence for boolean search
      return q === '*'
        ? { k: 'star', node: atom }
        : q === '+'
          ? { k: 'plus', node: atom }
          : { k: 'opt', node: atom };
    }
    if (q === '{') {
      const repeat = tryParseBrace();
      if (repeat !== null) return expandRepeat(atom, repeat.min, repeat.max);
    }
    return atom;
  }

  function tryParseBrace(): { min: number; max: number } | null {
    const m = /^\{(\d+)(,(\d*)?)?\}/.exec(src.slice(i));
    if (m === null) return null; // literal '{'
    i += m[0].length;
    if (peek() === '?') i += 1; // lazy
    const min = Number(m[1]);
    const max =
      m[2] === undefined ? min : m[3] === '' || m[3] === undefined ? Infinity : Number(m[3]);
    if (min > MAX_REPEAT || (max !== Infinity && max > MAX_REPEAT)) {
      throw new UnsupportedRegexError(`Repeat count over ${MAX_REPEAT} not supported: {${m[1]}…}`);
    }
    return { min, max };
  }

  function parseAtom(): AstNode {
    const c = peek();
    if (c === '(') return parseGroup();
    if (c === '[') return parseClass();
    if (c === '\\') return parseEscape();
    if (c === '.') {
      i += 1;
      return { k: 'any' };
    }
    if (c === '^') {
      i += 1;
      return { k: 'assert', kind: 'start' };
    }
    if (c === '$') {
      i += 1;
      return { k: 'assert', kind: 'end' };
    }
    if (c === undefined || c === '*' || c === '+' || c === '?' || c === ')') {
      throw new UnsupportedRegexError(`Unexpected '${c ?? '<end>'}' in pattern`);
    }
    i += 1;
    return { k: 'char', ch: c };
  }

  function parseGroup(): AstNode {
    i += 1; // consume '('
    if (peek() === '?') {
      const c2 = src[i + 1];
      if (c2 === '=' || c2 === '!' || c2 === '<') {
        if (!(c2 === '<' && /[A-Za-z]/.test(src[i + 2] ?? ''))) {
          throw new UnsupportedRegexError('Lookaround assertions are not supported');
        }
      }
      // (?: …) or (?<name> …): skip the prefix, treat as a plain group
      if (c2 === ':') i += 2;
      else if (c2 === '<') {
        i += 2;
        while (i < src.length && src[i] !== '>') i += 1;
        i += 1;
      }
    }
    const inner = parseAlt();
    if (peek() !== ')') throw new UnsupportedRegexError('Unbalanced group');
    i += 1; // consume ')'
    return inner;
  }

  function parseEscape(): AstNode {
    i += 1; // consume '\'
    const c = peek();
    if (c === undefined) throw new UnsupportedRegexError('Trailing backslash');
    if (/[1-9]/.test(c) || c === 'k')
      throw new UnsupportedRegexError('Backreferences are not supported');
    i += 1;
    if (c === 'b') return { k: 'assert', kind: 'wordB' };
    if (c === 'B') return { k: 'assert', kind: 'nonWordB' };
    const cls = escapeClass(c);
    if (cls !== null) return { k: 'class', test: cls };
    if (c === 'x' || c === 'u' || c === 'c') {
      const { ch, len } = c === 'c' ? readControlEscape(src, i) : readUnicodeEscape(src, i, c);
      i += len;
      return { k: 'char', ch };
    }
    return { k: 'char', ch: escapeLiteral(c) };
  }

  function parseClass(): AstNode {
    i += 1; // consume '['
    const negate = peek() === '^';
    if (negate) i += 1;
    // JS semantics: `[]` is an empty class (matches nothing) and `[^]` matches
    // anything — a leading `]` is NOT a literal member (that is POSIX). Use `[\]]`.
    const tests: Array<(c: string) => boolean> = [];
    while (i < src.length && peek() !== ']') {
      tests.push(parseClassMember());
    }
    if (peek() !== ']') throw new UnsupportedRegexError('Unterminated character class');
    i += 1; // consume ']'
    const base = (c: string): boolean => tests.some((t) => t(c));
    return { k: 'class', test: negate ? (c) => !base(c) : base };
  }

  function parseClassMember(): (c: string) => boolean {
    let lo: string;
    if (peek() === '\\') {
      i += 1;
      const e = eat();
      const cls = escapeClass(e);
      if (cls !== null) return cls;
      const r = classEscapeChar(src, i, e);
      i += r.len;
      lo = r.ch;
    } else {
      lo = eat();
    }
    if (peek() === '-' && src[i + 1] !== undefined && src[i + 1] !== ']') {
      i += 1; // consume '-'
      let hi: string;
      if (peek() === '\\') {
        i += 1;
        const e2 = eat();
        const r = classEscapeChar(src, i, e2);
        i += r.len;
        hi = r.ch;
      } else {
        hi = eat();
      }
      const a = lo.codePointAt(0)!;
      const b = hi.codePointAt(0)!;
      return (c) => {
        const p = c.codePointAt(0)!;
        return p >= a && p <= b;
      };
    }
    return (c) => c === lo;
  }

  const ast = parseAlt();
  if (i !== src.length) throw new UnsupportedRegexError(`Unexpected '${peek()}' at ${i}`);
  return ast;
}
