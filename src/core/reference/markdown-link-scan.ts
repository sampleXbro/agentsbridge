/**
 * Shared markdown link scanner.
 *
 * Extracts markdown link destinations (`[t](p)`, `![t](p)`, `[id]: p`) from a
 * content string and exposes each match with its byte-offset and length so
 * downstream consumers can either classify links (install: scope/broken-link
 * prompt) or rewrite them in place (link rebaser, install apply-decisions).
 *
 * Fenced code blocks (``` / ~~~) are protected: link patterns inside fences
 * are not extracted. Inline code spans and HTML comments are intentionally
 * not protected — downstream classifiers handle pathological markdown by
 * falling through to a "leave with warning" path rather than crashing.
 *
 * Scope: this module owns the *parsing* primitive. It does not classify
 * destinations as URLs, anchors, or relative paths — that is the consumer's
 * job (`scan-relative-links.ts` for install, the rebaser's protected-range
 * logic for generate/import).
 */

export type MarkdownLinkKind = 'inline' | 'image' | 'reference-def';

export interface MarkdownLinkToken {
  /** Inline (`[t](p)`), image (`![t](p)`), or reference-def (`[id]: p`). */
  readonly kind: MarkdownLinkKind;
  /** Destination as written, with `<...>` and title suffix stripped (anchor preserved). */
  readonly destination: string;
  /** Reference id for `reference-def`; undefined otherwise. */
  readonly label?: string;
  /** Offset of the destination inside the original content. */
  readonly destinationOffset: number;
  /** Length of the destination span inside the original content. */
  readonly destinationLength: number;
}

const FENCED_BLOCK = /^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)/gm;
const INLINE_LINK = /(!?)\[[^\]\n]*\]\(([^)\n]+)\)/g;
const REFERENCE_DEF = /^\s*\[([^\]\n]+)\]:\s*(.+?)\s*$/gm;

/** Return fenced code-block byte ranges (`[start, end)`). */
export function getFencedCodeRanges(content: string): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  for (const match of content.matchAll(FENCED_BLOCK)) {
    const start = match.index ?? 0;
    ranges.push([start, start + match[0].length]);
  }
  return ranges;
}

function isInRanges(offset: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (offset >= start && offset < end) return true;
  }
  return false;
}

/** Strip an optional `"title"` / `'title'` suffix and surrounding `<...>` from a destination. */
function normalizeDestination(raw: string): string {
  let s = raw.trim();
  const titleMatch = /^(.*?)\s+(["'])([\s\S]*?)\2\s*$/.exec(s);
  if (titleMatch?.[1] !== undefined) s = titleMatch[1].trim();
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim();
  return s;
}

/**
 * Scan `content` for markdown link tokens. Each token carries the offset and
 * length of the destination span in the original content so callers can
 * perform exact-range rewrites without touching surrounding markdown.
 */
export function scanMarkdownLinks(content: string): readonly MarkdownLinkToken[] {
  const fenced = getFencedCodeRanges(content);
  const out: MarkdownLinkToken[] = [];

  for (const match of content.matchAll(INLINE_LINK)) {
    const idx = match.index ?? 0;
    if (isInRanges(idx, fenced)) continue;
    const isImage = match[1] === '!';
    const inner = match[2];
    if (inner === undefined) continue;
    // Offset of the destination within the original content: position of `(` + 1.
    const openParen = content.indexOf('(', idx);
    if (openParen < 0) continue;
    const destOffset = openParen + 1;
    out.push({
      kind: isImage ? 'image' : 'inline',
      destination: normalizeDestination(inner),
      destinationOffset: destOffset,
      destinationLength: inner.length,
    });
  }

  for (const match of content.matchAll(REFERENCE_DEF)) {
    const idx = match.index ?? 0;
    if (isInRanges(idx, fenced)) continue;
    const label = (match[1] ?? '').trim();
    const rawDest = match[2] ?? '';
    if (label === '' || rawDest.trim() === '') continue;
    const lineStart = idx;
    const labelClose = content.indexOf(']:', lineStart);
    if (labelClose < 0) continue;
    // Skip `]:` and any whitespace before the destination starts.
    let destStart = labelClose + 2;
    while (
      destStart < content.length &&
      (content[destStart] === ' ' || content[destStart] === '\t')
    ) {
      destStart += 1;
    }
    out.push({
      kind: 'reference-def',
      destination: normalizeDestination(rawDest),
      label,
      destinationOffset: destStart,
      destinationLength: rawDest.trimEnd().length,
    });
  }

  return out;
}

/**
 * Apply a set of exact-range rewrites to `content`. Each rewrite specifies a
 * byte range to replace and the replacement text. Ranges must not overlap.
 * Ranges are applied in descending offset order so earlier offsets remain
 * valid during application.
 */
export interface RangeRewrite {
  readonly offset: number;
  readonly length: number;
  readonly replacement: string;
}

export function applyRangeRewrites(content: string, rewrites: readonly RangeRewrite[]): string {
  if (rewrites.length === 0) return content;
  const sorted = [...rewrites].sort((a, b) => b.offset - a.offset);
  let out = content;
  for (const r of sorted) {
    out = `${out.slice(0, r.offset)}${r.replacement}${out.slice(r.offset + r.length)}`;
  }
  return out;
}
