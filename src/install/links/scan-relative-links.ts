/**
 * Markdown link scanner used by install-time broken-link validation (B1).
 *
 * Thin filter over the shared `scanMarkdownLinks` primitive in
 * `src/core/reference/markdown-link-scan.ts`. The shared scanner owns the
 * markdown grammar (inline, image, reference-def) and fenced-code-block
 * protection; this module narrows the result to candidate relative paths
 * (URLs, anchors, absolute paths, mailto/tel/javascript schemes are excluded).
 *
 * Classification of in-tree / outside / unresolvable lives in `resolve-link`.
 */

import {
  scanMarkdownLinks,
  type MarkdownLinkToken,
} from '../../core/reference/markdown-link-scan.js';

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

/**
 * Normalize backslash separators to forward slashes so links authored on
 * Windows (`assets\logo.png`) resolve identically to POSIX-style paths and
 * downstream `path.resolve()` doesn't choke on mixed separators on POSIX.
 *
 * Also expands the `{baseDir}` placeholder convention used by Anthropic-style
 * skills (e.g. trailofbits/skills) to mean "the directory containing this
 * file". `{baseDir}/foo.md` → `foo.md` (sibling); bare `{baseDir}` → `.`.
 *
 * Anchors are preserved — `resolve-link` strips them on the way to disk and
 * echoes them back so callers can rewrite the link verbatim.
 */
function stripPath(destination: string): string {
  const forward = destination.replaceAll('\\', '/');
  if (forward === '{baseDir}') return '.';
  if (forward.startsWith('{baseDir}/')) return forward.slice('{baseDir}/'.length);
  return forward;
}

function toScannedLink(tok: MarkdownLinkToken): ScannedLink | null {
  const normalized = tok.destination;
  if (!isCandidateRelativePath(normalized)) return null;
  const base: ScannedLink = {
    raw: normalized,
    path: stripPath(normalized),
    kind: tok.kind,
    ...(tok.label !== undefined ? { label: tok.label } : {}),
  };
  return base;
}

export function scanRelativeLinks(content: string): readonly ScannedLink[] {
  const out: ScannedLink[] = [];
  for (const tok of scanMarkdownLinks(content)) {
    const link = toScannedLink(tok);
    if (link !== null) out.push(link);
  }
  return out;
}
