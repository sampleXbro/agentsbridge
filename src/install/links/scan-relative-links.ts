/**
 * Markdown link scanner used by install-time broken-link validation (B1).
 *
 * Walks a single entity body and extracts every relative link destination
 * (inline `[t](p)`, image `![a](p)`, or reference-style `[t][id]` + `[id]: p`).
 * The scanner is intentionally permissive: it only filters destinations that
 * are clearly non-local (URL schemes, mailto/tel/javascript, bare anchors,
 * absolute paths) and leaves classification of in-tree / outside / unreachable
 * to `resolve-link`.
 *
 * Fenced code blocks (``` and ~~~) are protected: any links inside are not
 * extracted. Other markdown constructs (inline code spans, HTML comments) are
 * intentionally NOT protected — install fixtures rarely contain pathological
 * markdown, and the safety boundary lives in `resolve-link` where unresolved
 * paths surface as warnings, not crashes.
 */

export type LinkKind = 'inline' | 'image' | 'reference-def';

export interface ScannedLink {
  /** Raw destination as written in the source (with `<>` and titles stripped). */
  readonly raw: string;
  /** Destination path, including any `#anchor` suffix; with title/angle stripped. */
  readonly path: string;
  /** `inline` for `[t](p)`, `image` for `![t](p)`, `reference-def` for `[id]: p`. */
  readonly kind: LinkKind;
  /** Reference id for `reference-def`; undefined otherwise. */
  readonly label?: string;
}

const FENCED_BLOCK = /^(?:```|~~~)[\s\S]*?\n(?:```|~~~)\s*$/gm;
const INLINE_LINK = /(!?)\[[^\]\n]*\]\(([^)\n]+)\)/g;
const REFERENCE_DEF = /^\s*\[([^\]\n]+)\]:\s*(.+?)\s*$/gm;

function isOffsetInRanges(
  offset: number,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
  for (const [start, end] of ranges) {
    if (offset >= start && offset < end) return true;
  }
  return false;
}

function fencedRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const match of content.matchAll(FENCED_BLOCK)) {
    const start = match.index ?? 0;
    ranges.push([start, start + match[0].length]);
  }
  return ranges;
}

/** Strip an optional `"title"` or `'title'` and surrounding `<>` from a destination. */
function normalizeDestination(raw: string): string {
  let s = raw.trim();
  const titleMatch = /^(.*?)\s+(["'])([\s\S]*?)\2\s*$/.exec(s);
  if (titleMatch?.[1] !== undefined) s = titleMatch[1].trim();
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim();
  return s;
}

/**
 * Return true when `destination` is a relative on-disk path that warrants
 * resolution (as opposed to a URL, mailto, anchor, or absolute reference).
 */
function isCandidateRelativePath(destination: string): boolean {
  if (destination.length === 0) return false;
  if (destination.startsWith('#')) return false;
  if (destination.startsWith('/')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(destination)) return false;
  return true;
}

function stripPath(destination: string): string {
  // Keep the #anchor — callers preserve it on rewrite; resolve-link strips it.
  return destination;
}

export function scanRelativeLinks(content: string): readonly ScannedLink[] {
  const protectedR = fencedRanges(content);
  const out: ScannedLink[] = [];

  for (const match of content.matchAll(INLINE_LINK)) {
    const idx = match.index ?? 0;
    if (isOffsetInRanges(idx, protectedR)) continue;
    const isImage = match[1] === '!';
    const inner = match[2];
    if (inner === undefined) continue;
    const normalized = normalizeDestination(inner);
    if (!isCandidateRelativePath(normalized)) continue;
    out.push({
      raw: normalized,
      path: stripPath(normalized),
      kind: isImage ? 'image' : 'inline',
    });
  }

  for (const match of content.matchAll(REFERENCE_DEF)) {
    const idx = match.index ?? 0;
    if (isOffsetInRanges(idx, protectedR)) continue;
    const label = (match[1] ?? '').trim();
    const rawDest = (match[2] ?? '').trim();
    if (label === '' || rawDest === '') continue;
    const normalized = normalizeDestination(rawDest);
    if (!isCandidateRelativePath(normalized)) continue;
    out.push({
      raw: normalized,
      path: stripPath(normalized),
      kind: 'reference-def',
      label,
    });
  }

  return out;
}
