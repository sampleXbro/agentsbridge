# Fix-All from Pre-Push Review

**Created:** 2026-05-17
**Status:** Draft — awaiting confirmation.

> 25 unpushed commits reviewed; ~36 findings. This plan groups them into
> apply / investigate / skip buckets so we don't change behavior we don't
> understand.

---

## Phase 1 — Critical correctness (TDD, will apply)

1. **`pack-writer.ts:182-186` — atomicity swap.** Replace `rm(finalDir) → rename(tmp, finalDir)` with `rename(finalDir → ${packName}.old) → rename(tmp → finalDir) → rm(${packName}.old)`. POSIX rename over a non-existent target is atomic; the swap removes the crash window. New test: simulate crash between rm-old and rm-new (kill via injected fault) and assert either old-pack OR new-pack present, never neither.

2. **`utils/crypto/hash.ts:21-22` — Buffer hashing.** Drop the `'utf8'` arg from `readFile`; hash the `Buffer` directly. Add unit tests for binary input + CRLF/LF parity. Audit callers — `hashContent(string)` stays string for the manifest comparison path.

3. **`apply-uninstall.ts:56` — drop `force: true`.** The `exists()` guard at line 55 already handles ENOENT. Real permission errors should surface, not be swallowed. Test: rm against a path whose parent is read-only → expect throw, not silent success.

4. **`uninstall-decisions.ts:73-86` — short-circuit on null packDir.** For extends-only plans (`plan.packDir === null`), return `{ ..., packDirMissing: false }` immediately without stat'ing `join(packsDir, plan.name)`. Test: plan with `packDir: null` does not call `exists()` on any path.

5. **`aggregate.test.ts:131-132` — `.some()` → `toEqual`.** Replace `losers.some(p => p.includes(...))` with full-array assertion matching the strict-artifact rule.

6. **`run-install-execute.ts` — 236 lines, over cap.** Extract `pickReuseEntryName` + `sameFeaturesSet` into `src/install/core/pick-reuse-entry-name.ts`. Also dedupe `sameFeatures` in `install-manifest.ts:33` (same logic) into the new module. Target: <200 lines.

## Phase 2 — Type / contract precision

7. **`apply-decisions.ts:55` + `resolve-link.ts`** — narrow `ResolvedLink` with a discriminated union: when `classification === 'resolvable-outside'`, `resolvedRelative` must be `string` not `string | null`. Drop the dead null-check.

8. **`target-descriptor.schema.ts:133-145`** — replace `.passthrough()` coverage of `conversionDefaults` and `excludeFromStarterInit` with explicit `z.boolean()` / `z.object(...)` validators. Plugins shipping `conversionDefaults: { commandsToSkills: 'yes' }` should fail validation.

9. **`install-abort-error.ts:19`** — `isInstallAbortError` is exported with zero callers (`grep` confirmed); the only catch site uses `instanceof InstallAbortError` directly. Remove the unused export.

10. **`uninstall-result.ts:37`** — for extends-only plans (`plan.packDir === null`), set `previewEntries[].pack_path` to `null`, not `join(packsDir, plan.name)`. Add JSON-output test.

## Phase 3 — Behavioral fixes

11. **`uninstall-decisions.ts:91-92` — `--keep-pack` should still run `detectModifiedFiles`.** Currently returns `modifications: []` without reading the manifest, so `appliedEntry.modified_files_kept` is empty even when the user kept the pack precisely *because* it was modified. Keep the prompt bypass but populate `modifications` for the JSON record.

12. **`run-uninstall.ts:78-80` — non-TTY without `--force` must emit through `logger.error`** before throwing, matching the rest of the CLI's validation pattern. Return `{ exitCode: 1, data: {...} }` instead of raising a raw `Error`.

13. **`install-manifest.ts:33-38` + `run-install-execute.ts:204` — `sameFeatures` dedup.** Both sites do the same comparison with O(n²) re-sorting. Consolidate in `pick-reuse-entry-name.ts` (Phase 1.6), sort each side once.

14. **`resolve-link.ts:73`, `scan-relative-links.ts:67-73` — Windows path normalization.** `stripPath()` should normalize `\` → `/` before checking; `resolve()` should receive native-separator paths and the result should be normalized once. Add a unit test with `assets\logo.png` style input.

15. **`bulk-prompt.ts:108` — whitespace handling.** Tier 2's `if (tier2 !== 'c') return abort` interprets a stray space as abort. Trim input; add test for `' '`.

16. **`run-install-locked.ts:96` — backslash normalization.** `pathInRepo.replace(/^\/+|\/+$/g, '')` doesn't touch backslashes. Reuse the same forward-slash normalizer used in CLI output.

17. **`merge-commands.ts:52`** — remove redundant `sort` on already-ordered list.

## Phase 4 — Test gaps

18. `install-manifest-hash.test.ts` — add CRLF/LF parity test and binary-file test (paired with Phase 1.2).

19. `install-lock.test.ts` — add tests for: stale-PID eviction, missing `holder.json`, EACCES on the lock directory.

20. `uninstall-modified.integration.test.ts` — exercise the `[k]eep-modified` prompt branch end-to-end via the existing `PromptAdapter` injection. Currently has zero integration coverage.

21. `aggregate.test.ts` — add a broken-link assertion case where `entityKind === 'rule'` (currently only covers `agent` and `command`).

22. `uninstall-decisions.test.ts` (new or extended) — assert that `gatherUninstallDecisions` discards `decisions[0]` when `plans[1]` aborts (exit-130 invariant).

## Phase 5 — Stale docs

23. `.agentsmesh/skills/add-agent-target/references/target-addition-checklist.md:44` — replace stale `DEFAULT_COMMANDS_TO_SKILLS` / `DEFAULT_AGENTS_TO_SKILLS` instructions with the new descriptor-driven pattern (`conversionDefaults: { ... }`).

24. `website/src/content/docs/cli/uninstall.mdx:36` — exit code `2` is documented as reserved but never emitted; remove from the table (or implement — recommend remove since `0` + `skipped` array is the current contract).

25. `docs/architecture/install.md:59` — per-target-commands description hardcodes "claude / gemini / cursor"; reword as "any descriptor whose `managedOutputs.dirs` contains `.<tool>/commands`."

## Phase 6 — Nice to have

26. `target-descriptor.ts:166-168` — typed `id` as discriminated `BuiltinTargetId | (string & {})` to catch typos at compile time within the 10 builtin descriptors (plugins still widen via the string fallback).

27. `cli/renderers/installs.ts:13-21` — tighten `widths` typing to `Record<typeof COLUMNS[number]['key'], number>` so the defensive `?? 0` becomes provably unreachable.

28. Local variable shadowing: rename `const global = ...` → `globalLayout` in `antigravity/index.ts:63`, `codex-cli/index.ts:67`, `gemini-cli/index.ts:97`, `kiro/index.ts:72`, `windsurf/index.ts:92`. Sibling targets (amp, cline, goose, warp, continue) already use `globalLayout`.

29. `parseNames` in `run-uninstall.ts:39-50` — drop the silent dedup so `planUninstall`'s duplicate-name throw can fire as documented.

## Phase 7 — Investigate before changing

These items need verification before I touch them — current behavior may be intentional:

A. **`registry.ts:18-22` circular-import band-aid.** The lesson at `tasks/lessons.md:248` documents that the current "filter undefined slots, defer caching until full" mitigation works. The reviewer's "break the cycle structurally" suggestion is more invasive and risks regressing the descriptor refactor that just shipped (b58629d, c292e4b). **Recommend: keep current mitigation; add an explicit unit test that locks the contract** ("during cycle resolution, `getDescriptor(x)` returns a partial map and doesn't cache"). Update the file comment to point at the lesson for future readers.

B. **`detect-modified.ts:68-70` error-vs-deleted.** `hashFile()` already distinguishes `ENOENT` (returns null) from other errors (throws). The reviewer's TOCTOU concern is narrow: file present at `readDirRecursive`, deleted before `hashFile` — folded into `deleted`. In practice this only fires when something else is racing the uninstall, which the install lock prevents. **Recommend: add a comment explaining why `null` here means "raced-deletion is fine to call deleted"; no code change.**

C. **`goose/index.ts:83-86` dead branch.** `GOOSE_SKILLS_DIR` and `GOOSE_GLOBAL_SKILLS_DIR` are **both `.agents/skills`** (confirmed in `constants.ts:19,26`). The `if (path.startsWith(...))` and the fall-through both return the same value. Not a bug — just dead code. **Recommend: collapse to a single comment explaining the equality, no behavior change.**

D. **`cline/index.ts:67,113` same-path project/global.** `CLINE_SKILLS_DIR === '.cline/skills'` for both scopes by design (no global-skills-dir constant exists). **Recommend: no change; tighten cline's `managedOutputs.dirs:80` to remove the duplicate `'.agents/skills'` entry if it's truly never produced — verify by reading mirrorGlobalPath at line 99.**

E. **`warp/index.ts:90-92` rulePath returning a directory.** `globalCapabilities.rules === 'none'` so the resolver should never be called. **Recommend: change return to `null` and update `TargetPathResolvers.rulePath`'s type to `string | null` — costs ~5 sites that already handle null command/agent paths. Lock with a unit test.**

F. **`antigravity/index.ts:91` global agentPath returns project dir.** Rescued by `rewriteGeneratedPath` at line 74-76 (the `.agents/skills/` rewrite). The path callback's return value is then either consumed pre-rewrite (in which case this is a bug) or post-rewrite (in which case correct). **Recommend: add a unit test that calls `globalSupport.layout.paths.agentPath(...)` and asserts the global path — if it fails, fix the callback to use `ANTIGRAVITY_GLOBAL_SKILLS_DIR`; if the test doesn't matter (no callers), do nothing.**

## Phase 8 — Working-tree noise (separate from review)

- `.mcp.json` — Prettier collapsed `args` arrays onto one line; benign formatting drift.
- `.agentsmesh/.lock` — timestamp from a local generate.
- `tests/e2e/agents-last-run.md` — timestamp from a local e2e run.

**Recommend: revert these locally (`git restore`) before pushing. They are not part of the review and shouldn't ship with the commits.** If `.lock` and `agents-last-run.md` are routinely regenerated, consider adding `update-index --skip-worktree` or excluding via gitignore — separate task.

---

## Verification gate

After each phase: `pnpm test` + `pnpm typecheck`. After Phase 1+3 specifically: `pnpm flake:watch` to confirm no regression in the watch-loop test stability.

Final gate: full integration suite + e2e (`pnpm test:e2e`).
