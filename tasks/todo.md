# Descriptor-Driven Native Format Detection

**Created:** 2026-05-17
**Status:** Draft — ready for TDD.

> Prior plan (skill-pack-aware install + uninstall) shipped — see git log
> `cfab483` through `f080ce0`. Reset for this new task.

---

## Goal

Make `detectNativeFormat()` self-scaling so it covers **all 30 builtin
targets today** and any future target the moment its directory lands
under `src/targets/<id>/`. No hand-edited target list, no hand-edited
signature paths, no per-target weights.

## Problem

`src/config/resolve/native-format-detector.ts:9-81` carries a hardcoded
`TARGET_SIGNATURES` array covering only 11 of 30 targets:

- Auto-detected: claude-code, cursor, copilot, gemini-cli, codex-cli,
  windsurf, cline, continue, junie, kiro, kilo-code.
- Require `--target` flag: aider, amazon-q, amp, antigravity,
  augment-code, crush, deepagents-cli, factory-droid, goose, jules,
  opencode, pi-agent, qwen-code, replit-agent, roo-code, rovodev, trae,
  warp, zed.

Every descriptor already declares a `detectionPaths: readonly string[]`
field (`src/targets/catalog/target-descriptor.ts:202`) plus
`globalSupport.detectionPaths` for global mode. Five other modules
already read these (`public/targets.ts`, `core/reference/import-map-shared.ts`,
`core/reference/link-format-registry.ts`, scaffold templates).

`native-format-detector.ts` is the only place that ignores them.

## Architecture

```
detectNativeFormat(repoPath)
  │
  ▼
1. Build pathOwnerCount map once from BUILTIN_TARGETS:
   path → number of descriptors that list it.
        │
        ▼
2. For each descriptor, compute:
     - uniqueHits  = paths present on disk where ownerCount === 1
     - sharedScore = Σ 1/ownerCount for paths present where ownerCount ≥ 2
        │
        ▼
3. Rank by (uniqueHits desc, sharedScore desc, id asc).
4. **Return null when the winner has 0 unique hits** (only shared markers
   are present — genuinely ambiguous).
```

**Why unique-marker-wins:**

- **Honest about ambiguity.** Seven targets share `AGENTS.md`
  (`amp, codex-cli, factory-droid, jules, pi-agent, rovodev, warp`).
  A bare `AGENTS.md` repo could be any of them. Returning null lets the
  caller prompt the user instead of silently guessing.
- **Strong markers dominate.** `.cursor/rules` (unique) beats
  `AGENTS.md` (shared) regardless of how many shared markers also
  match.
- **Self-scaling.** When a new target ships, only its own unique paths
  fire. Adding the 8th target that lists `AGENTS.md` shrinks shared
  weight for every existing target but never causes a target with a
  unique marker to lose to one without.
- **Pure function over descriptor data — no new fields.**

**Consequence:** `jules` (only `AGENTS.md` in its descriptor) is
deliberately undetectable from path signatures. Users install jules
repos with `--target jules`. That's the right behavior — guessing jules
from `AGENTS.md` would be wrong six out of seven times.

## Phases (TDD)

### P1 — Failing tests

`tests/unit/config/native-format-detector.test.ts`:

- [x] P1.1 Parameterized: every target whose `detectionPaths` includes
  **at least one path unique to that descriptor** resolves to its own id
  when only that unique path exists. (29 of 30 — only `jules` is
  excluded; verified below.)
- [x] P1.2 Ambiguity returns null: only `AGENTS.md` present → null
  (shared by 7 targets, no unique marker).
- [x] P1.3 Unique marker dominates shared: `.cursor/mcp.json` (unique)
  + `AGENTS.md` (shared) → `cursor`.
- [x] P1.4 Empty dir → null (existing assertion kept).
- [x] P1.5 `KNOWN_NATIVE_PATHS` derived from descriptors (length ===
  `BUILTIN_TARGETS.length`, in BUILTIN_TARGETS order).
- [x] P1.6 Backward-compat: each of the 11 originally-detected targets
  still resolves on the existing fixtures.
- [x] P1.7 jules is documented as deliberately undetectable
  (assert `await detectNativeFormat(repoWithOnlyAgentsMd) !== 'jules'`).

### P2 — Implement detector

- [x] P2.1 Rewrite `native-format-detector.ts`:
  - Compute `pathOwnerCount: Map<string, number>` once from
    `BUILTIN_TARGETS` (path → number of descriptors that include it).
  - `detectNativeFormat()` scores each descriptor by summing
    `1 / pathOwnerCount.get(rel)` for every existing path.
  - Tie-break: alphabetic `descriptor.id`.
  - Return `null` when max score === 0.
- [x] P2.2 `KNOWN_NATIVE_PATHS` becomes
  `BUILTIN_TARGETS.flatMap(d => d.detectionPaths[0] ?? []).filter(Boolean)`.
- [x] P2.3 `pnpm test tests/unit/config/native-format-detector.test.ts`
  GREEN.

### P3 — Catalog verify guard

- [x] P3.1 Extend `scripts/generate-target-catalog.ts` `assertHasDescriptorExport`
  (or add a new assertion) to require `detectionPaths.length >= 1` on
  every descriptor. Failing message points contributor at the missing
  field.
- [x] P3.2 `pnpm catalog:generate --verify` GREEN.

### P4 — Adapt stale assertions

- [x] P4.1 Replace `KNOWN_NATIVE_PATHS` length-11 expectation with a
  derivation check (length === `BUILTIN_TARGETS.length` and equal to
  the live derivation).
- [x] P4.2 Update tie-break assertion comments. (CLAUDE.md +
  `.cursorrules` both score 1.0 currently — under exclusivity weights
  both paths are unique, so each scores 1.0; tie-break by alphabetic id
  selects `claude-code` over `cursor`. Behavior unchanged on this
  specific case — keep test, refresh comment.)
- [x] P4.3 Update AGENTS.md test: previously resolved to codex-cli by
  array order. Under exclusivity + alphabetic tie-break it may resolve
  differently if multiple descriptors list `AGENTS.md`. Verify and
  assert the deterministic answer (whatever it is — test asserts the
  actual self-scaling behavior, not a preference).

### P5 — Final verification

- [x] V1 `pnpm lint` GREEN
- [x] V2 `pnpm typecheck` GREEN
- [x] V3 `pnpm typecheck:tests` GREEN
- [x] V4 `pnpm test` full suite GREEN
- [x] V5 `pnpm test:e2e` GREEN
- [x] V6 `pnpm matrix:verify` GREEN
- [x] V7 Manual probe: build a fixture dir with only an `opencode.jsonc`
  or `.zed/settings.json` (previously not auto-detected) and confirm
  `detectNativeFormat` returns the right id.
- [x] V8 Append discoveries to `tasks/lessons.md` (e.g. exclusivity
  weighting choice, AGENTS.md disambiguation result).

### P6 — Commit

- [ ] C1 Single commit:
  `refactor(install): derive native-format detection from descriptors`

## Out of scope

- `--target <id>` flag — already self-scaling via auto-generated
  `BUILTIN_TARGET_IDS`. No change.
- Global-mode detection — `globalSupport.detectionPaths` is already
  descriptor-driven; only the project-mode detector has the duplicate.
  Verify in P5 V7 by inspection.
- Adding new `detectionPaths` markers to descriptors — out of scope
  unless a test reveals a target lacks a strong marker.
- Per-marker confidence weights beyond exclusivity — defer until a real
  miss surfaces.

## Open notes

- The current detector counts a hit once per path. The new one weights
  by exclusivity. Targets with many overlapping shared markers will
  score lower than targets with one unique marker — this is the desired
  behavior.
- Iteration order over `BUILTIN_TARGETS` is alphabetical (auto-gen). We
  also alphabet-sort on tie-break to keep the rule explicit even if the
  iteration order ever changes.
