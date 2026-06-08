# Move claude-code project root instruction: `.claude/CLAUDE.md` → root `CLAUDE.md`

Scope: **project only**. Global mode stays `.claude/CLAUDE.md`. Auto-clean legacy `.claude/CLAUDE.md` on generate.

## Source
- [ ] `constants.ts`: `CLAUDE_ROOT='CLAUDE.md'`; add `CLAUDE_NESTED_ROOT='.claude/CLAUDE.md'`; drop `CLAUDE_LEGACY_ROOT`.
- [ ] `index.ts`: project `rootInstructionPath`/managed → root; list legacy `.claude/CLAUDE.md` in project managed.files for stale-clean; global `rootInstructionPath=CLAUDE_NESTED_ROOT` + `rewriteGeneratedPath` maps `CLAUDE_ROOT→CLAUDE_NESTED_ROOT`; importer prefers root then nested (project), nested (global); detection paths.
- [ ] `generator.ts`: comment fixes only (uses `CLAUDE_ROOT`).
- [x] checked `core/reference/map.ts` (redundant, no change), `import-maps/claude-code.ts` (ok), `global-instructions.ts` (global-only).

## Tests (red→green, exact paths/counts)
- [ ] generator.test, contract claude-code, layout-metadata, shared-root-instruction-paths
- [ ] stale-cleanup: project scope removes legacy `.claude/CLAUDE.md`
- [ ] link-rebaser suite (depth change from root), generate/import integration + e2e, round-trip, research suites
- [ ] importer.test (prefer root, fall back to nested)

## Docs
- [ ] README matrix, website supported-tools.mdx, cli/import.mdx

## Verify — ALL COMPLETE ✅
- [x] full suite green (8676 passed, e2e incl.); typecheck + lint clean
- [x] dogfood: `generate` → created root `CLAUDE.md`, auto-removed legacy `.claude/CLAUDE.md`, `check` in sync
- [x] docs regenerated (matrix:generate → supported-tools.mdx + import.mdx)
