---
"agentsmesh": minor
---

**Breaking (descriptor authors):** Built-in targets now declare global mode under `globalSupport` (capabilities, detection paths, layout, optional `scopeExtras`) instead of separate `global`, `globalCapabilities`, and `globalDetectionPaths` fields. Command/workflow and Gemini settings generation are modeled with capability **flavors** on the canonical generators; Copilot/Cursor root mirrors use `layout.outputFamilies` for rewrite cache keys.

**CLI / docs:** `pnpm matrix:generate` refreshes README and website support-matrix blocks from the catalog; `pnpm matrix:verify` fails on drift (also runs in CI). Init detection uses `collectDetectionPaths` from the catalog.
