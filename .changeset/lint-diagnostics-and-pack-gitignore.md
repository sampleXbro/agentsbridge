---
'agentsmesh': minor
---

Adds three new `agentsmesh lint` diagnostics, a recommended `.gitignore` policy for materialized packs, and a one-step `agentsmesh target-scaffold` workflow.

Added:
- New lint diagnostics: `silent-drop-guard` flags canonical content a target would otherwise drop without trace, `hook-script-references` reports hook commands pointing at missing wrapper scripts, and `rule-scope-inversion` catches manual-activation rules whose scope contradicts the target's projection rules. They are wired into `runLint` for every target via descriptor capabilities, so existing configs may surface new warnings; no rule has been removed.
- `agentsmesh init` now writes `.agentsmesh/packs/` into `.gitignore` alongside `agentsmesh.local.yaml`, `.agentsmeshcache`, and `.agentsmesh/.lock.tmp`. Materialized packs are treated like `node_modules` — `installs.yaml` is committed and `agentsmesh install --sync` reproduces the tree deterministically post-clone.
- `agentsmesh target-scaffold` post-steps collapse the previous three-edit sequence into one `pnpm catalog:generate` invocation, backed by a new auto-discovered builtin-target catalog (`scripts/generate-target-catalog.ts` + `pnpm catalog:verify` drift guard in CI).

Changed:
- The `agentsmesh.json` and `pack.json` schemas now list `targets` enums alphabetically. Schema consumers that pin order will see a one-time diff; values are unchanged.
- README documents the commit-vs-gitignore convention for generated tool folders and clarifies native Windows support (no WSL).

Internal:
- Per-target importers (`antigravity`, `claude-code`, `continue`, `copilot`, `cursor`, `gemini-cli`, `junie`, `kiro`, `roo-code`) migrated to the descriptor-driven import runner with mapper functions extracted into `import-mappers.ts` to keep `index.ts` ↔ `importer.ts` cycles out of the TDZ.
- New shared link-format registry (`src/core/reference/link-format-registry.ts`) consolidates per-target link rendering rules.
