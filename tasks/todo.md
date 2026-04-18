# Generated Markdown Link Rebasing

## Goal

Ensure every generated Markdown file, including `.cursor/AGENTS.md`, participates in the shared link rebaser and does not leak canonical `.agentsmesh/skills/...` references.

## Plan

- [x] Add failing regression for `.cursor/AGENTS.md` exact relative skill directory links.
- [x] Fix output-source mapping so layout-declared additional root Markdown outputs are rewritten.
- [x] Fix shared formatter so nested generated Markdown uses explicit `./` descendant links.
- [x] Regenerate/verify live generated Cursor output.
- [x] Run targeted tests, lint/typecheck/build gates, and post-feature QA.

## Notes

- Reported leak: `.cursor/AGENTS.md` contains `.agentsmesh/skills/post-feature-qa/`; expected `./skills/post-feature-qa/`.

## QA Report

| Criterion | Evidence | Status |
| --- | --- | --- |
| `.cursor/AGENTS.md` receives shared link rebasing | `tests/unit/core/generate-reference-rewrite-root-mirrors.test.ts` requires `./skills/post-feature-qa/` exactly | OK |
| Additional root Markdown mirrors are source-mapped generically | `src/core/reference/output-source-map.ts` maps `additionalRootDecorationPaths` for root rules | OK |
| Nested generated Markdown uses explicit current-directory links | `tests/unit/core/link-rebaser-output.test.ts` covers `./commands/...`, `./skills/...`, and `./references/...` formatting | OK |
| Live generated artifact is corrected | `node dist/cli.js generate` updated `.cursor/AGENTS.md`; grep shows `./skills/post-feature-qa/` and no `.agentsmesh/skills/` in generated target dirs | OK |
| Broad regression surface remains green | `pnpm lint`, `pnpm typecheck`, `pnpm test` (224 files / 2400 tests), targeted integration/e2e suites | OK |
| Post-feature QA completed | Acceptance criteria and edge cases checked against `.agents/skills/post-feature-qa/SKILL.md` workflow | OK |
