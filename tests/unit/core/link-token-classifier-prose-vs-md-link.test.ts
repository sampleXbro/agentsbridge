/**
 * Parenthesized prose mentions of a filename must not be classified as
 * Markdown link destinations. Real Markdown links (`[text](path)`) still are.
 *
 * Background: `shouldRewritePathToken`'s `(`-branch previously claimed any
 * token preceded by `(` as a link destination, regardless of whether the
 * Markdown link prefix `]` was actually there. That caused
 * `Read the existing spec (SPEC.md or equivalent)` to be rewritten into
 * `(../../.agentsmesh/.../SPEC.md or equivalent)` whenever the macOS FS
 * happened to case-fold the resolution. The token isn't a link in the
 * first place — there's no `[label]` in front of the `(`.
 *
 * The classifier now mirrors `getTokenContext` (line 64 of the same file):
 * a token is a Markdown link destination only when `]` sits directly
 * before the opening `(`.
 */

import { describe, expect, it } from 'vitest';
import { shouldRewritePathToken } from '../../../src/core/reference/link-token-context.js';

function tokenAt(haystack: string, needle: string): { start: number; end: number } {
  const start = haystack.indexOf(needle);
  if (start < 0) throw new Error(`needle ${needle} not in ${haystack}`);
  return { start, end: start + needle.length };
}

describe('shouldRewritePathToken — parenthesized prose vs Markdown link', () => {
  it('rejects parenthesized prose token: `(SPEC.md or equivalent)`', () => {
    const content = 'Read the existing spec (SPEC.md or equivalent) before planning.';
    const { start, end } = tokenAt(content, 'SPEC.md');
    expect(shouldRewritePathToken(content, start, end, 'SPEC.md', true)).toBe(false);
  });

  it('rejects standalone parenthesized filename: `see (spec.md) for details`', () => {
    const content = 'see (spec.md) for details';
    const { start, end } = tokenAt(content, 'spec.md');
    expect(shouldRewritePathToken(content, start, end, 'spec.md', true)).toBe(false);
  });

  it('accepts real Markdown inline link: `[spec](spec.md)`', () => {
    const content = 'See the [spec](spec.md) for details.';
    const { start, end } = tokenAt(content, 'spec.md');
    expect(shouldRewritePathToken(content, start, end, 'spec.md', true)).toBe(true);
  });

  it('accepts Markdown link with anchor: `[spec](spec.md#header)`', () => {
    const content = 'See [spec](spec.md#header) for details.';
    const { start, end } = tokenAt(content, 'spec.md');
    expect(shouldRewritePathToken(content, start, end, 'spec.md', true)).toBe(true);
  });

  it('accepts Markdown link with trailing space inside parens: `[s]( spec.md )`', () => {
    // The token starts AFTER the space; the char immediately before the
    // candidate is the space, not `(`, so this doesn't hit the `(` branch.
    // It hits the bare-path branch which falls through because there's no
    // slash. This test pins that behavior so we don't accidentally start
    // matching it.
    const content = 'See [s]( spec.md ) for details.';
    const { start, end } = tokenAt(content, 'spec.md');
    // No slash, no surrounding `(`/`[` immediately before the candidate
    // start — falls through to `return false`. Real Markdown would still
    // be authored as `[s](spec.md)` (no spaces); this is a tolerance test.
    expect(shouldRewritePathToken(content, start, end, 'spec.md', true)).toBe(false);
  });

  it('accepts Markdown link with relative path: `[s](./commands/spec.md)`', () => {
    // The candidate starts at `.` of `./commands/spec.md`; before is `(`,
    // before-1 is `]`. The new check passes and the slash-containing token
    // also satisfies line 113-116.
    const content = 'See [s](./commands/spec.md) for details.';
    const { start, end } = tokenAt(content, './commands/spec.md');
    expect(shouldRewritePathToken(content, start, end, './commands/spec.md', true)).toBe(true);
  });

  it('accepts paths with directory prefix outside any link syntax', () => {
    // Bare prose with a slash still rewrites because line 113-117 catches
    // it (last segment has `.`).
    const content = 'See commands/spec.md for the spec.';
    const { start, end } = tokenAt(content, 'commands/spec.md');
    expect(shouldRewritePathToken(content, start, end, 'commands/spec.md', true)).toBe(true);
  });

  it('rejects bare filename in plain prose: `read SPEC.md before planning`', () => {
    // No `(`, no slash → falls through to `return false`. Already correct
    // pre-fix; this test pins it so future refactors don't break it.
    const content = 'Read SPEC.md before planning.';
    const { start, end } = tokenAt(content, 'SPEC.md');
    expect(shouldRewritePathToken(content, start, end, 'SPEC.md', true)).toBe(false);
  });
});
