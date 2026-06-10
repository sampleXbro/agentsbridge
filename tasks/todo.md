# Fix lessons --help drift (4 issues) — single-source + strict tests

## Root cause
The lessons subcommand set / flags / usage signatures are duplicated across 4 help
surfaces with no shared source, so they drifted from the real CLI (the `runLessons`
dispatcher in `src/cli/commands/lessons.ts` is the runtime truth: 13 subcommands).

## Design: one canonical source, everything else derives-or-asserts against it
`src/cli/commands/lessons-usage.ts` becomes the single source:
- `LESSONS_USAGE` covers ALL 13 subcommands (add 8: topics, show, strip-markers,
  journal, validate, stats, prune, import-md). `example?` optional; add `summary?`
  for the parenthetical notes.
- `LESSONS_SUBCOMMANDS = Object.keys(LESSONS_USAGE)` — the canonical ordered list.

## Tasks (TDD: failing test first, then implement) — ALL DONE
- [x] 1. lessons-usage.ts: complete LESSONS_USAGE (13) + summary/optional example +
      LESSONS_SUBCOMMANDS. Strict test lessons-usage.test.ts (exact list, keys, prefix, show<topic>).
- [x] 2. help.ts: guarded `usage?.example` (topics exemplar still valid).
- [x] 3. renderers/lessons.ts printHelp derived from LESSONS_USAGE. Test lessons-help.test.ts
      (bare menu == LESSONS_SUBCOMMANDS, ANSI-stripped exact lines).
- [x] 4. help-data.ts: description generated from LESSONS_SUBCOMMANDS + 5 flags added.
      Tests in help.test.ts (description toEqual list; per-sub show/strip-markers/prune/stats).
- [x] 5. lessons.test.ts: dispatcher↔canonical parity block.
- [x] 6. skill.ts description = all 13; skill.test.ts strict description gate.
- [x] 7. Regenerated: build → init --lessons (canonical SKILL.md) → generate (23 target copies).
- [x] 8. Verified: 104 targeted tests + full suite (8806, 1 flaky watch), typecheck, lint,
      `agentsmesh check` in sync. End-to-end CLI confirmed all 4 issues.

## Notes
- Shared working tree: many unrelated modified files (process-lock/install-lock/gitignore/
  errors/init/README/website + lessons.json captures + .lock) are a CONCURRENT session's
  work — NOT touched, NOT mine. My change is surgical to the lessons help surface.
- Captured lesson: strip ANSI before line-exact CLI stdout assertions.

## Constraints (from lessons recall)
- Files <=200 lines (lessons-usage.ts will be ~100 — ok).
- No irregular whitespace / no literal block-comment fence in comments.
- Lock strict tests to OBSERVED rendered output, not inferred intent.
