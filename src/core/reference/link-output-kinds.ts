/**
 * Typed output forms and token-context vocabulary for the link rebaser.
 *
 * These types are infrastructure for the unified rebaser design described in
 * docs/architecture/link-rebaser-vision.md.  They make the formatting-decision
 * layer auditable and open the door to context-aware formatting rules without
 * changing the current string-based public API.
 */

/**
 * Syntactic role of a path token within source content.
 * Drives which formatting strategy is applied in `formatLinkPathForDestination`.
 */
export type TokenContext =
  | { role: 'markdown-link-dest' } // inside [label](dest) — must be destination-relative
  | { role: 'inline-code' } // inside `…` — preserve well-known anchors
  | { role: 'bracketed' } // inside <…>
  | { role: 'quoted' } // inside "…" or '…'
  | { role: 'at-prefix' } // @path/to/file (Codex, Junie style)
  | { role: 'bracket-label' } // [label] when label itself is a path
  | { role: 'bare-prose' }; // naked in prose (opt-in with rewriteBarePathTokens)

/**
 * Tagged output form of a rewritten link path.
 * Carries semantic kind so comparators can apply context-appropriate ranking
 * rather than relying on raw string-prefix heuristics.
 */
export type RewrittenLink =
  | { kind: 'external'; text: string } // http://, ssh://, mailto:, C:\
  | { kind: 'absolute'; text: string } // /root/absolute
  | { kind: 'home'; text: string } // ~/foo
  | { kind: 'wellKnown'; anchor: string; rest: string; text: string } // .agentsmesh/skills/foo
  | { kind: 'projectRoot'; rest: string; text: string } // src/foo.ts
  | { kind: 'destinationRelative'; text: string } // ./foo or ../foo
  | { kind: 'unchanged'; text: string }; // leave original token as-is
