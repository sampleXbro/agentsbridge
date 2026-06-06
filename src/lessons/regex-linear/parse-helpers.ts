/** Helpers for {@link parseRegex}: bounded-repeat expansion and escape handling. */

import type { AstNode } from './parse.js';

export const MAX_REPEAT = 1000;

export const isWord = (c: string): boolean => /[A-Za-z0-9_]/.test(c);

/** Expand `{min,max}` into required copies + optional/star copies (linear-engine has no counted repeat). */
export function expandRepeat(atom: AstNode, min: number, max: number): AstNode {
  const items: AstNode[] = [];
  for (let k = 0; k < min; k += 1) items.push(atom);
  if (max === Infinity) {
    items.push({ k: 'star', node: atom });
  } else {
    for (let k = min; k < max; k += 1) items.push({ k: 'opt', node: atom });
  }
  if (items.length === 0) return { k: 'empty' };
  return items.length === 1 ? items[0]! : { k: 'concat', items };
}

/** Predicate for a class escape (`\d \w \s` …); null when the escape is a literal. */
export function escapeClass(c: string): ((c: string) => boolean) | null {
  switch (c) {
    case 'd':
      return (x) => x >= '0' && x <= '9';
    case 'D':
      return (x) => !(x >= '0' && x <= '9');
    case 'w':
      return isWord;
    case 'W':
      return (x) => !isWord(x);
    case 's':
      return (x) => /\s/.test(x);
    case 'S':
      return (x) => !/\s/.test(x);
    default:
      return null;
  }
}

/** The literal character an escape stands for (`\t`, `\n`, …, or the char itself). */
export function escapeLiteral(c: string): string {
  switch (c) {
    case 't':
      return '\t';
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 'f':
      return '\f';
    case 'v':
      return '\v';
    case '0':
      return '\0';
    default:
      return c; // \. \/ \( … → the literal character
  }
}
