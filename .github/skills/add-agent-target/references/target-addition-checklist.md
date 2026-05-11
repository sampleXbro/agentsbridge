# Target Addition Checklist

Concrete audit list for adding a built-in agent target. For the step-by-step workflow, see `docs/add-new-target-playbook.md`.

## Research (non-skippable)

Every item must have a primary-source link before coding starts:

- Official docs URL for the tool (becomes `metadata.officialUrl` — must be a canonical, stable URL)
- Human-readable display name (becomes `metadata.displayName` — used in every doc table and tool list)
- One-line description (becomes `metadata.shortDescription` — used in tool lists for SEO)
- Tool category — one of: `cli` | `ide` | `agent-platform` (becomes `metadata.category` — groups the target on the homepage and supported-tools page)
- Exact product surface being implemented (CLI vs desktop vs chat — often different config systems)
- Project-scope config directory and root-instruction file
- Global-scope config directory and root-instruction file
- File formats for each supported feature (Markdown + frontmatter, YAML, TOML, JSON)
- Frontmatter keys and schema per feature
- Legacy or fallback paths still in use
- Capability map — for each canonical feature, one of: `native`, `embedded`, `partial`, `none`
- Conversion eligibility — for each `none` feature, can it be projected as a skill? (see below)
- MCP scope (project file, user-home config, app-managed connector, unsupported)

## Code Touchpoints

Registration (must edit these three files for a built-in target):

- `src/targets/catalog/target-ids.ts` — add the new id to `TARGET_IDS`
- `src/targets/catalog/builtin-targets.ts` — import the descriptor and add to `BUILTIN_TARGETS`
- `src/core/reference/import-maps/index.ts` — re-export the new target's import-paths helper

Target implementation (scaffold produces these; fill in):

- `src/targets/<id>/constants.ts` — project and global path constants
- `src/targets/<id>/index.ts` — the `TargetDescriptor` (capabilities, layouts, detection paths)
- `src/targets/<id>/generator.ts` — feature generators (`generateRules` minimum)
- `src/targets/<id>/importer.ts` — `importFrom` implementation
- `src/targets/<id>/linter.ts` — rule linter (often thin wrapper over shared `validateRules`)
- `src/targets/<id>/lint.ts` — per-feature lint hooks (commands, mcp, permissions, hooks, ignore)
- `src/core/reference/import-maps/<id>.ts` — canonical ↔ target reference path map

Conversion eligibility (when `commands` or `agents` is `none` but `skills` is `native` or `embedded`):

- `src/targets/<id>/index.ts` — add `supportsConversion: { commands: true, agents: true }` (only the features that are `none`)
- `src/config/core/conversions.ts` — add the target to `DEFAULT_COMMANDS_TO_SKILLS` and/or `DEFAULT_AGENTS_TO_SKILLS` with `true`
- Do NOT add lint warnings for converted features — they are projected as skills, not dropped
- Only add lint warnings for features that are truly unsupported (no native support AND no skill fallback, e.g. hooks, permissions, MCP when project-only)

Shared code to audit, not usually modify:

- `src/config/core/schema.ts` — target id validation runs off `TARGET_IDS`, no edits needed
- `src/cli/help-data.ts` — only if the target introduces new flags; avoid if possible
- `src/core/matrix/data.ts` — auto-derived from descriptor capabilities, no edits needed
- `src/core/generate/collision.ts` — only if declaring `sharedArtifacts`

## Documentation Touchpoints

The following are **all auto-generated** by `pnpm matrix:generate` from descriptor data — no manual edits:

- `README.md` — feature matrices + tool-list (from `metadata` + `capabilities`)
- `website/src/content/docs/reference/supported-tools.mdx` — feature matrices (from `capabilities`)
- `website/src/content/docs/cli/import.mdx` — import-targets table (from `metadata` + `descriptor.importer`)
- `website/src/content/docs/index.mdx` — homepage tool-list (from `metadata` grouped by `category`)

Manual edits:

- `website/src/content/docs/reference/supported-tools.mdx` — per-target detail sections (paths, native vs embedded, limitations, global-mode notes). Add a section for the new target.
- `docs/prd-v2-complete.md` — only if the architecture contract changes

After adding the descriptor metadata, run `pnpm matrix:generate && pnpm matrix:verify`. CI will fail any PR where docs drift from `TARGET_REGISTRY` (see `src/targets/catalog/target-metadata-registry.ts`).

No other docs pages should need edits per repo rules.

## Unit Tests

- `tests/unit/targets/<id>/generator.test.ts`
- `tests/unit/targets/<id>/importer.test.ts`
- `tests/unit/targets/<id>/global-layout.test.ts` (when the target supports global mode)
- `tests/unit/targets/<id>/<feature>-helpers.test.ts` (only if the target has complex helpers)
- Shared tests (`tests/unit/core/engine.test.ts`, `tests/unit/core/matrix/*.test.ts`) only when behavior there changes

Assertions must be strict: exact paths, exact counts, exact referenced sets. No `some(...)`, no `toBeGreaterThan(0)` on lengths, no prefix-only matching.

## Integration Tests

- `tests/integration/generate.integration.test.ts` — when CLI generate wiring is affected
- `tests/integration/import.integration.test.ts` — when CLI import wiring is affected
- `tests/integration/init.integration.test.ts` — when init detection changes

## E2E Tests

- `tests/e2e/generate-capabilities.e2e.test.ts` — add a describe block for the new target
- `tests/e2e/import-capabilities.e2e.test.ts` — add import round-trip cases
- `tests/e2e/full-sync.e2e.test.ts` — when the target supports import
- `tests/e2e/<id>-format-roundtrip.e2e.test.ts` — only for complex targets with non-trivial format handling (see `claude-code-format-roundtrip.e2e.test.ts` as reference)
- Global coverage — add to existing global roundtrip suites rather than creating new isolated files

## Fixture Requirements

Create `tests/e2e/fixtures/<id>-project/` with realistic content:

- Target's root instructions file (with real prose, not a placeholder)
- Scoped rules or equivalent (with frontmatter, globs, trigger markers as applicable)
- Commands or workflows if supported
- Agents if supported
- Skills with at least one supporting file (`references/`, `scripts/`, or `template.*`)
- Settings, MCP, hooks, ignore files as applicable
- Legacy/fallback variant in a separate fixture if the target has path precedence rules

Reference fixtures for comparison:

- `tests/e2e/fixtures/kiro-project/` — 10 files, rules + skills + MCP (mid-complexity)
- `tests/e2e/fixtures/claude-code-project/` — 14 files, full feature set (high-complexity)

## Edge Cases To Cover

- Missing config produces the correct empty-state message from `emptyImportMessage`
- Legacy path fallback (when the target has one)
- Precedence when both legacy and current formats exist
- Malformed JSON/TOML/frontmatter (importer must not crash)
- Partial feature translation (document lossy behavior in tests)
- Existing settings merge preservation (when generator writes into a shared settings file)
- Rich skill directories with nested supporting files
- `--targets <id>` filtering
- Full round-trip import → generate when the target supports import
- Global-scope variants for every project-scope test, when the target supports global

## Global Mode (new targets must include from day one)

- `descriptor.global` filled in with paths and managed outputs
- `descriptor.global.rewriteGeneratedPath` transforms project paths to global
- `descriptor.globalCapabilities` set only if different from project scope
- `descriptor.globalDetectionPaths` populated
- Optional: `descriptor.globalSupport.skillMirror` for targets that read skills from a mirror path
- Optional: `descriptor.sharedArtifacts` when the target shares a global path with another target
- Tests: `global-layout.test.ts` asserts descriptor shape; existing global roundtrip suites exercise the runtime behavior

If the target genuinely has no global surface (e.g. a project-only tool), document the decision in `supported-tools.mdx` and omit `descriptor.global` entirely.

## Plugin Path Alternative

If the target is niche or the maintainer prefers independent release, ship as a plugin instead. See `docs/add-new-target-playbook.md` §7 for the standalone npm package layout. The descriptor contract is identical; only the packaging and registration differ.

## Verification Gates

Before marking complete, every command must exit 0:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm matrix:verify`
- `pnpm publint`
- `pnpm attw`
- `pnpm consumer-smoke`

## Review Questions

- Did you search the internet first, using official docs only?
- Did you start from `agentsmesh target scaffold <id>`, or did you hand-write the skeleton?
- Did you replace every `TODO(agentsmesh-scaffold)` marker in the descriptor `metadata` block with real values (`displayName`, `category`, `officialUrl`, `shortDescription`)?
- Did you write failing tests first?
- Did you add rich fixtures instead of placeholders?
- Did you register the id in all three catalog files (`target-ids.ts`, `builtin-targets.ts`, `import-maps/index.ts`)?
- Did you include global mode, or document the decision to omit it?
- Did you check conversion eligibility for `none` features — could commands/agents be projected as skills instead of dropped?
- Did you run `pnpm matrix:generate` to refresh README + website auto-generated blocks from the new descriptor `metadata`?
- Did you update `supported-tools.mdx` with per-target detail (paths, native vs embedded, limitations, global-mode notes)?
- Did every verification command pass, including `pnpm matrix:verify`?
