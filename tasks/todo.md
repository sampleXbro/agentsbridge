# Compatibility Matrix Alignment

## Goal

Make the README and website compatibility matrices match the current implementation source of truth.

## Plan

- [x] Extract the current target capability matrix from code descriptors.
- [x] Compare implementation output with README and website docs.
- [x] Update docs or tests for any drift found, keeping the supported-tools page as the single detailed docs table.
- [x] Verify with targeted matrix/docs tests plus lint/typecheck/build as appropriate.
- [x] Run post-feature QA and record evidence.

## Notes

- Source of truth: `src/targets/catalog/target-ids.ts` and target descriptor `capabilities`.
- Docs that must align: `README.md` and `website/src/content/docs/reference/supported-tools.mdx`.

## QA Report

| Criterion | Evidence | Status |
| --- | --- | --- |
| README feature matrix matches descriptor capabilities | `tests/unit/core/matrix-docs.test.ts` parses `README.md` and compares each cell to `SUPPORT_MATRIX` | OK |
| Website feature matrix matches descriptor capabilities | `tests/unit/core/matrix-docs.test.ts` parses `website/src/content/docs/reference/supported-tools.mdx` and compares each cell to `SUPPORT_MATRIX` | OK |
| Cline hook support reflects implementation | `tests/unit/core/matrix.test.ts` asserts Cline has a hook generator, project capability is `native`, and matrix output is `native` | OK |
| Kiro agent support is documented as native | README and supported-tools docs now match `src/targets/kiro/index.ts`; covered by docs matrix test | OK |
| Antigravity global workflows are documented | README and supported-tools global docs include `~/.gemini/antigravity/workflows/`; covered by docs test | OK |
| Global docs table follows canonical target order | `tests/unit/core/matrix-docs.test.ts` checks the website global table order against `TARGET_IDS` | OK |
| CLI matrix sample matches current formatter | `website/src/content/docs/cli/matrix.mdx` uses the boxed symbol table and all 12 targets; covered by docs test | OK |
| Stale website path details were cleaned up | Supported-tools/import docs updated for Claude ignore, Copilot prompts/hooks, Gemini paths, Cline paths/hooks, Codex native paths, Continue MCP, Junie MCP/ignore | OK |
| Typecheck gate stays clean | Fixed regex capture narrowing in `src/core/reference/validate-generated-markdown-links.ts` after `pnpm typecheck` surfaced `TS2532` | OK |

## Verification

- `pnpm exec vitest run tests/unit/core/matrix.test.ts tests/unit/core/matrix-docs.test.ts tests/unit/targets/descriptor-paths.test.ts tests/unit/targets/target-ids.test.ts tests/unit/targets/builtin-targets.test.ts tests/unit/cli/commands/matrix.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (226 files / 2432 tests)
- `pnpm --dir website build`
