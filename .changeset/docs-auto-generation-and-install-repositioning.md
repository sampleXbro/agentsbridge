---
'agentsmesh': patch
---

Auto-generate every user-facing target listing from `TARGET_REGISTRY`, and reposition install methods so AgentsMesh is no longer presented as Node-only.

**Auto-generated target listings**

`pnpm matrix:generate` now writes three new auto-generated marker blocks in addition to the existing project/global feature matrices:

- `tool-list` (README + homepage) — every target grouped by category with links to the official tool URL
- `import-targets` (`cli/import.mdx`) — all 30 targets with their primary read path
- `tool-details` (`reference/supported-tools.mdx`) — uniform per-target sections with display name, category, official URL, project + global root paths, and skill directory

`pnpm matrix:verify` (CI gate) fails the build whenever any of the four documents drift from the catalog. The render script was split into `scripts/support-matrix-blocks.ts` (pure builders) and a slim orchestrator.

**Hardcoded enumerations removed**

Replaced with links to the support matrix or generated content:

- README import-target list (was 13/30) and tool-format examples
- Homepage prose enumeration of 15+ tools
- `cli/import.mdx` per-target source→canonical mapping tables (only 7/30 documented) — collapsed into a single canonical-pattern table plus editorial caveats for the 5 targets with real implementation quirks
- `cli/init.mdx` auto-detection list (12 hardcoded paths) and starter-config example
- `cli/generate.mdx` output-locations table (was 12/30)
- `canonical-config/commands.mdx` + `canonical-config/hooks.mdx` per-target feature support enumerations
- `reference/supported-tools.mdx` per-tool detail sections (was 24/30 hand-written, ~494 lines) replaced with the auto-generated `tool-details` block covering all 30 targets uniformly

**Install repositioning**

AgentsMesh now presents three install methods as equals — Homebrew (no Node.js required), standalone binary (no Node.js required), and npm/pnpm/yarn (Node.js 20+). The `getting-started/installation.mdx` page rewrite uses a Tabs block with a "which method should I use?" comparison table. The README install section was reordered (Homebrew first, npm last) and `npx agentsmesh ...` was stripped from every non-install code sample — `npx` survives only in the two explicit "run without installing" snippets where it's the legitimate use. CI workflow examples, guides, and command-reference pages now use the plain `agentsmesh` binary, which works after any install method (with `npx` documented as the prefix for users who chose `npm install -D`).
