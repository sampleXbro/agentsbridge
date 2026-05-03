# Target Addition Checklist

Concrete audit list for adding a built-in agent target. For the step-by-step workflow, see `docs/add-new-target-playbook.md`.

## Research (non-skippable)

Every item must have a primary-source link before coding starts:

- Official docs URL for the tool
- Exact product surface being implemented (CLI vs desktop vs chat — often different config systems)
- Project-scope config directory and root-instruction file
- Global-scope config directory and root-instruction file
- File formats for each supported feature (Markdown + frontmatter, YAML, TOML, JSON)
- Frontmatter keys and schema per feature
- Legacy or fallback paths still in use
- Capability map — for each canonical feature, one of: `native`, `embedded`, `partial`, `none`
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

Shared code to audit, not usually modify:

- `src/config/core/schema.ts` — target id validation runs off `TARGET_IDS`, no edits needed
- `src/cli/help-data.ts` — only if the target introduces new flags; avoid if possible
- `src/core/matrix/data.ts` — auto-derived from descriptor capabilities, no edits needed
- `src/core/generate/collision.ts` — only if declaring `sharedArtifacts`

## Documentation Touchpoints

- `README.md` — matrix tables update automatically via `pnpm matrix:generate`
- `website/src/content/docs/reference/supported-tools.mdx` — single docs page for per-target detail (paths, native vs embedded, limitations). Update this manually.
- `docs/prd-v2-complete.md` — only if the architecture contract changes
- No other docs pages should need edits per repo rules

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
- Did you write failing tests first?
- Did you add rich fixtures instead of placeholders?
- Did you register the id in all three catalog files (`target-ids.ts`, `builtin-targets.ts`, `import-maps/index.ts`)?
- Did you include global mode, or document the decision to omit it?
- Did you update `supported-tools.mdx` with per-target detail?
- Did every verification command pass?
