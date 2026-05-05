# Current Task: Raise JSON CLI Branch Patch Coverage

1. [x] Inspect new CLI command/result/rendering contracts and current unit-test helpers without touching unrelated dirty files.
2. [x] Add focused failing tests for JSON/text branch behavior in `src/cli/command-handlers.ts` and renderer modules listed by Codecov.
3. [x] Cover renderer edge/error states for plugin, target, check, init, lint, install, diff, import, and merge output paths.
4. [x] Run targeted unit coverage for the touched CLI tests and verify missing patch lines are materially reduced.
5. [x] Run `pnpm typecheck`, `pnpm lint`, and targeted/full tests as practical.
6. [x] Apply `post-feature-qa` before marking complete.

# Previous Task: Link Rebaser — Surgical Hardening (lessons-180)

1. [x] Add ESLint scoped guard banning risky `node:path` imports in `src/core/reference/**` via `importNames` (join, relative, normalize, isAbsolute, dirname, resolve). Allows `posix`, `win32`, `basename`.
2. [x] Replace risky `node:path` imports with `pathApi(projectRoot)` in 4 files: `import-rewriter.ts`, `import-map-shared.ts`, `pack-skill-artifact-paths.ts`, `link-rebaser-helpers.ts`. Lint clean; 4867 unit tests green.
3. [x] Add focused unit tests for `resolveLinkTarget` at `tests/unit/core/link-rebaser-resolve-target.test.ts` (7 cases, all green).
4. [x] Targeted: `pnpm typecheck`, `pnpm lint`, `pnpm test -- tests/unit/core/link-rebaser` — clean (4867 tests).
5. [x] Broader: integration + e2e reference-rewrite (37 + 19), full e2e (444), full `pnpm test` (4874), `pnpm test:e2e` (421) — all green.
6. [x] Apply `post-feature-qa` and report results — no gaps; one negative-twin test added during QA bringing total to 8.

# Previous Task: Review And Improve Link Rebasing

1. [x] Read lessons and architecture notes relevant to reference rewriting.
2. [x] Audit current link rebasing implementation, tests, and dirty diffs without reverting user work.
3. [x] Add a failing focused test for Windows-shaped destination-relative paths.
4. [x] Implement the smallest shared-code improvement.
5. [x] Re-plan after `pnpm test` showed a broad non-Markdown gate conflicted with supporting-file rewrite fixtures.
6. [x] Re-run targeted tests plus lint/typecheck/full test where practical.
7. [x] Apply `post-feature-qa` and report results.

# Current Task: Complete Kilo Code Target Integration Audit

1. [x] Load lessons, `add-agent-target` playbook, and checklist.
2. [x] Verify current Kilo Code format from primary docs.
3. [x] Audit source, fixtures, tests, docs, matrix, and catalog registration.
4. [x] Patch gaps without disturbing unrelated dirty work.
5. [x] Run required verification gates.
6. [x] Apply `post-feature-qa` and report completion with source links.

# Current Task: Run All Tests And Fix Test Failures

1. [x] Run the full test suite and capture failing suites/tests.
2. [x] Attribute failures to test expectations or fixtures without changing library logic.
3. [x] Patch only tests, fixtures, or test helpers as needed.
4. [x] Re-run targeted failing tests, then the full suite.
5. [x] Apply post-feature QA and report results.

# Add Target: kilo-code

## Source research (primary docs)

- https://kilo.ai/docs (canonical docs)
- https://kilo.ai/docs/customize/agents-md
- https://kilo.ai/docs/customize/custom-rules
- https://kilo.ai/docs/customize/custom-subagents
- https://kilo.ai/docs/customize/skills
- https://kilo.ai/docs/customize/workflows
- https://kilo.ai/docs/customize/context/kilocodeignore
- https://kilo.ai/docs/automate/mcp/using-in-kilo-code
- https://kilo.ai/docs/getting-started/settings/auto-approving-actions
- https://kilo.ai/articles/roo-to-kilo-migration-guide
- https://github.com/Kilo-Org/kilocode (real-world examples: `.kilo/skills/jetbrains-ui-style/SKILL.md`, `.kilocode/skills/vscode-visual-regression/SKILL.md`, root `AGENTS.md`)
- https://github.com/punal100/get-stuff-done-for-kilocode (legacy `.kilocode/` example with `.kilocodemodes`, `.kilocode/rules/`, `.kilocode/workflows/`)

## Product surface

Kilo Code is a multi-surface AI coding platform — VS Code extension, JetBrains plugin, CLI (`kilo`), cloud agent. All read the same on-disk config files (the CLI is the runtime backbone). It is a **fork of Roo Code** (which is a fork of Cline). Currently in mid-migration from a "legacy" Roo-style layout to a "new" OpenCode-style layout. **Both layouts are live and supported simultaneously.**

## Layout decision (the contract this target implements)

| Surface | Generated path | Notes |
|---|---|---|
| Root rule | `AGENTS.md` | Kilo's documented portable root. Always loaded. Uppercase. |
| Non-root rules | `.kilo/rules/<slug>.md` | New layout. Auto-loaded by Kilo when `kilo.jsonc.instructions` references them; the user wires this once. |
| Commands | `.kilo/commands/<name>.md` | New layout. `description` frontmatter only (kilo recognizes more keys but description is sufficient). |
| Agents | `.kilo/agents/<name>.md` | New first-class subagent format. YAML frontmatter: `description`, `mode: subagent`. |
| Skills | `.kilo/skills/<slug>/SKILL.md` + supporting files | New layout. Anthropic-conventional skill bundle. |
| MCP | `.kilo/mcp.json` | `mcpServers` wrapper format (matches roo / cline / kilo legacy). |
| Ignore | `.kilocodeignore` | Legacy filename — only natively-loaded ignore file in kilo today (auto-migrated by `IgnoreMigrator`). |
| Hooks | — | **Not supported** by kilo. Emit lint warning. |
| Permissions | — | **Not supported in v1** (would require generating `kilo.jsonc`; out of scope). Emit lint warning. |

## Capability map

Project + global identical:

```
rules:           native
additionalRules: native
commands:        native
agents:          native     ← kilo has first-class subagents (not embedded as skills like cline)
skills:          native
mcp:             native
hooks:           none       ← kilo has no user-facing hook system
ignore:          native     ← .kilocodeignore (legacy filename, current native path)
permissions:     none       ← would require kilo.jsonc; v1 omission
```

## Global mode

Generated under `~/.kilo/` for consistency (matches new-layout skill path; same pattern roo-code uses with `~/.roo/`):

| Surface | Global path |
|---|---|
| Root rule | `.kilo/AGENTS.md` |
| Non-root rules | `.kilo/rules/<slug>.md` |
| Commands | `.kilo/commands/<name>.md` |
| Agents | `.kilo/agents/<name>.md` |
| Skills | `.kilo/skills/<slug>/SKILL.md` |
| MCP | `.kilo/mcp.json` |
| Ignore | `.kilocodeignore` |
| Skills mirror | `.agents/skills/<slug>/...` (cross-agent compat; suppressed if codex-cli is active — same pattern as roo/cline) |

`rewriteGeneratedPath`:
- `AGENTS.md` → `.kilo/AGENTS.md` (the project's root file becomes nested under the global parent)
- All other `.kilo/...` paths pass through unchanged
- `.kilocodeignore` passes through unchanged

## Detection paths

Project (init looks for any of these to consider kilo-code already configured):
- `.kilo/rules`, `.kilo/commands`, `.kilo/agents`, `.kilo/skills`, `.kilo/mcp.json`
- Legacy: `.kilocode/rules`, `.kilocode/workflows`, `.kilocode/skills`, `.kilocode/mcp.json`, `.kilocodemodes`, `.kilocodeignore`
- `kilo.jsonc`, `kilo.json`

Do NOT include `AGENTS.md` (shared with cline / codex-cli / others — would false-trigger).

Global:
- `.kilo/rules`, `.kilo/commands`, `.kilo/agents`, `.kilo/skills`
- Legacy: `.kilocode/rules`, `.kilocode/skills`

## Importer

Import from BOTH new (`.kilo/`) and legacy (`.kilocode/`) layouts so existing kilo / Roo-era users can migrate cleanly.

Per-feature import sources:
- **rules root**: `AGENTS.md` (new) → fall back to `.kilocode/rules/00-root.md` or first `.kilocode/rules/*.md` (legacy)
- **rules non-root**: `.kilo/rules/*.md` (new) + `.kilocode/rules/*.md` (legacy) — merge both, dedupe on slug
- **commands**: `.kilo/commands/*.md` (new) + `.kilocode/workflows/*.md` (legacy)
- **agents**: `.kilo/agents/*.md` (new YAML frontmatter format) + `.kilocodemodes` (legacy YAML `customModes` array, similar to `.roomodes`)
- **skills**: `.kilo/skills/<slug>/` (new) + `.kilocode/skills/<slug>/` (legacy)
- **mcp**: `.kilo/mcp.json` (new) → fall back `.kilocode/mcp.json` (legacy)
- **ignore**: `.kilocodeignore` (the only native ignore file)

Strip generated AgentsMesh decorations from imported `AGENTS.md` content via the shared `stripAgentsmeshRootInstructionParagraph` helper.

## Hard reference: closest analog

`roo-code` is the most direct analog (kilo is a roo fork). `cline` provides the AGENTS.md + skills + ignore patterns.

Copy-template plan:
- `index.ts` — model after `src/targets/roo-code/index.ts` but use AGENTS.md as root (cline pattern), promote `agents` from `partial` to `native` (kilo has first-class agents, roo only has custom modes), drop `hooks` (kilo: none), keep `permissions: none`.
- `generator.ts` — model after `src/targets/roo-code/generator.ts`. Same simple per-feature emit. Add `generateAgents()` that emits `.kilo/agents/<name>.md` with proper YAML frontmatter (don't emit `.kilocodemodes` — that's legacy).
- `importer.ts` + `import-mappers.ts` — model after `src/targets/roo-code/importer.ts` + `src/targets/roo-code/import-mappers.ts`. Add legacy-path fallbacks (`.kilocode/...`) for every feature.
- `linter.ts` + `lint.ts` — same as roo-code (rules linter + lint warnings for unsupported hooks/permissions).

## Files to create/modify

### Created (12)
- `src/targets/kilo-code/constants.ts`
- `src/targets/kilo-code/index.ts`
- `src/targets/kilo-code/generator.ts`
- `src/targets/kilo-code/importer.ts`
- `src/targets/kilo-code/import-mappers.ts`
- `src/targets/kilo-code/linter.ts`
- `src/targets/kilo-code/lint.ts`
- `src/core/reference/import-maps/kilo-code.ts`
- `tests/unit/targets/kilo-code/generator.test.ts`
- `tests/unit/targets/kilo-code/importer.test.ts`
- `tests/unit/targets/kilo-code/global-layout.test.ts`
- `tests/e2e/fixtures/kilo-code-project/...` (rich fixture: AGENTS.md + .kilo/{rules,commands,agents,skills}/, .kilo/mcp.json, .kilocodeignore, README.md)

### Modified (auto-generated catalog files updated by `pnpm catalog:generate`)
- `src/targets/catalog/builtin-target-ids-generated.ts`
- `src/targets/catalog/builtin-targets.ts`
- `src/core/reference/import-maps/index.ts`

### Modified (manual)
- `tests/e2e/generate-capabilities.e2e.test.ts` — add `describe('kilo-code', ...)` block
- `tests/e2e/import-capabilities.e2e.test.ts` — add import round-trip cases
- `tests/e2e/full-sync.e2e.test.ts` — add kilo-code round-trip
- `website/src/content/docs/reference/supported-tools.mdx` — add kilo-code section
- `README.md` — auto-updated by `pnpm matrix:generate` between sentinel comments
- `.changeset/<new>.md` — minor changeset entry: `feat(targets): add kilo-code target`

## Workflow

1. Run `pnpm exec agentsmesh target scaffold kilo-code --name "Kilo Code"` — produces 10-file skeleton.
2. Run `pnpm catalog:generate` — auto-registers in target-ids + builtin-targets + import-maps barrel.
3. Run `pnpm typecheck` — verify scaffold compiles.
4. Author the rich fixture under `tests/e2e/fixtures/kilo-code-project/` (NOT placeholder content).
5. Write failing unit tests (`generator.test.ts`, `importer.test.ts`, `global-layout.test.ts`) — must fail.
6. Replace constants.ts with the layout decided above.
7. Replace index.ts capabilities + descriptor wiring (project layout, global layout, rewriteGeneratedPath, mirrorGlobalPath, globalSupport extras).
8. Implement generator.ts feature-by-feature; iterate to green on unit tests.
9. Implement importer.ts + import-mappers.ts (in a third file to avoid TDZ — see lessons L188).
10. Wire `src/core/reference/import-maps/kilo-code.ts`.
11. Add e2e blocks for kilo-code in the three e2e suites.
12. Run targeted suites green: `pnpm test -- tests/unit/targets/kilo-code` and the new e2e blocks.
13. Update `website/src/content/docs/reference/supported-tools.mdx`.
14. Run `pnpm schemas:generate && pnpm matrix:generate && pnpm matrix:verify`.
15. Author changeset.
16. Run full verification stack:
    - `pnpm typecheck`
    - `pnpm lint`
    - `pnpm test`
    - `pnpm build && pnpm test:e2e`
    - `pnpm matrix:verify`
    - `pnpm publint`
    - `pnpm attw`
    - `pnpm consumer-smoke`
17. Apply `post-feature-qa` skill.

## Lessons applied (from `tasks/lessons.md`)

- L91/L74: edits go in `.agentsmesh/` source, not generated dirs.
- L188: per-target import mappers MUST live in `import-mappers.ts` (third file), never in `importer.ts` — TDZ trap.
- L190: `flatFile` import mode does NOT model multi-file merge. The kilo importer needs imperative merge for new+legacy rule dirs.
- L175 / L206: any path-derived identifier uses `basename` from `node:path` (NOT `split('/').pop()`). CLI display paths normalize with `.replaceAll('\\', '/')`.
- L7: importer fixtures use real `serializeProjectedAgentSkill()` shapes — but kilo has first-class agents so no projection in either direction.
- L85/L121: separate the kilo product (CLI + VS Code extension reading the same on-disk files) from the legacy Roo runtime.
- L72: AgentsMesh root-instruction paragraph uses worded "the `.agentsmesh` directory" form, not literal `.agentsmesh/` — verified clean by reuse of the shared decorator.
- L143: `stripAgentsmeshRootInstructionParagraph` runs on import for all root files (AGENTS.md and legacy fallbacks).
- L150: global import never recurses from `homedir()`; only walks `~/.kilo/...` and `~/.kilocode/...`.
- L165: `mirrorGlobalPath` checks the FILTERED active-targets list — codex-cli skip is uniformly handled.
- L156: avoid global-path collisions — `.kilo/AGENTS.md` is namespaced under `.kilo/`, not at `~/AGENTS.md`.
- L188 + L189: per-target import mappers in third file; don't use `flatFile` for multi-source merges.

## Out of scope for v1

- Generating `kilo.jsonc` master config (would unlock permissions and modern MCP `mcp` key).
- Mode-scoped legacy rules (`.kilocode/rules-<mode>/`) — import only as flat rules, do not generate.
- `.kilocodemodes` legacy generation — only import path, generation uses new `.kilo/agents/`.
