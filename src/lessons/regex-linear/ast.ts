/** AST + error type for the linear command_pattern engine (see parse.ts). */

export type AstNode =
  | { k: 'empty' }
  | { k: 'char'; ch: string }
  | { k: 'any' }
  | { k: 'class'; test: (c: string) => boolean }
  | { k: 'assert'; kind: 'start' | 'end' | 'wordB' | 'nonWordB' }
  | { k: 'concat'; items: AstNode[] }
  | { k: 'alt'; opts: AstNode[] }
  | { k: 'star'; node: AstNode }
  | { k: 'plus'; node: AstNode }
  | { k: 'opt'; node: AstNode };

/** Thrown by the parser for syntax the linear engine cannot evaluate. */
export class UnsupportedRegexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedRegexError';
  }
}
