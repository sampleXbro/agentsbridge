---
'agentsmesh': minor
---

Adds three new `agentsmesh lint` diagnostics, a recommended `.gitignore` policy for materialized packs, and a one-step `agentsmesh target-scaffold` workflow.

Added:
- New lint diagnostics, all emitted as warnings (do not change `lint`'s exit code):
  - `silent-drop-guard` flags canonical content a target would otherwise drop without trace based on its capability map.
  - `hook-script-references` warns when a hook command references a script path for any target whose generator does not copy hook scripts into its output. **All built-in targets except Copilot fall under this rule today.** Existing hook configs that reference local script paths (e.g. `./scripts/pre-commit.sh`) will surface a new warning per matching target on the first lint after upgrade. The script must already exist relative to the hook execution directory or the generated config will fail at runtime — the diagnostic just makes the gap visible.
  - `rule-scope-inversion` catches manual-activation rules whose scope contradicts the target's projection rules.
  All three are wired into `runLint` for every target via descriptor capabilities; no existing rule has been removed and no diagnostic is upgraded to error severity.
- `agentsmesh init` now writes `.agentsmesh/packs/` into `.gitignore` alongside `agentsmesh.local.yaml`, `.agentsmeshcache`, and `.agentsmesh/.lock.tmp`, and skips entries already covered by a broader pre-existing pattern (e.g. an existing `.agentsmesh/` line covers `.agentsmesh/packs/`). Materialized packs are treated like `node_modules` — `installs.yaml` is committed and `agentsmesh install --sync` reproduces the tree deterministically post-clone.
- `agentsmesh target-scaffold` post-steps collapse the previous three-edit sequence into one `pnpm catalog:generate` invocation, backed by a new auto-discovered builtin-target catalog (`scripts/generate-target-catalog.ts` + `pnpm catalog:verify` drift guard in CI).

Changed:
- The `agentsmesh.json` and `pack.json` schemas now list `targets` enums alphabetically. Schema consumers that pin order will see a one-time diff; values are unchanged.
- README documents the commit-vs-gitignore convention for generated tool folders and clarifies native Windows support (no WSL).

Internal:
- Per-target importers (`antigravity`, `claude-code`, `continue`, `copilot`, `cursor`, `gemini-cli`, `junie`, `kiro`, `roo-code`) migrated to the descriptor-driven import runner with mapper functions extracted into `import-mappers.ts` to keep `index.ts` ↔ `importer.ts` cycles out of the TDZ.
- New shared link-format registry (`src/core/reference/link-format-registry.ts`) consolidates per-target link rendering rules.
- `writeFileAtomic` now refuses to follow a pre-existing symlink at the target path (closes a TOCTOU window where a swapped symlink could redirect writes outside the project tree).
- `agentsmesh plugin add` now warns that plugins load as trusted Node.js modules with full process privileges.
