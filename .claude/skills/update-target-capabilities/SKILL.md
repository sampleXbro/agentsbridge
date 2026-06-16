---
name: update-target-capabilities
description: Use when an AI tool gains support for a feature agentsmesh does not yet expose, and you must raise an existing target's capability for project and/or global scope (rules, additionalRules, commands, agents, skills, mcp, hooks, ignore, permissions). Also use to audit every target for capability gaps. Covers research, descriptor wiring, round-trip symmetry, settings-merge safety, plugin safety, strict TDD, two-stage review, and matrix/docs sync.
---

## Purpose

# Update Target Capabilities

Use this skill when an existing target already lives in `src/targets/<target>/` and the underlying tool has started supporting a canonical feature that agentsmesh declares as `none` (or under-declares as `partial`). The job is to raise that capability — correctly, for the right scope(s), with the generate **and** import sides symmetric — and to prove it.

This is the skill `add-agent-target` defers to under "changing capability levels for an existing target." Use `add-agent-target` only for a brand-new target id; use `add-global-mode-target` only for first-time global wiring of a target that predates global support.

Read `./references/capability-update-checklist.md` before editing code. It holds the decision matrices and the full touchpoint/test/review list.

## When To Use

- A tool shipped a new feature surface (a config file, a settings key, a hooks format) that agentsmesh does not yet generate or import.
- You are auditing all targets for gaps ("which features do tools now support that we declare `none`?").
- A capability is declared `partial` but the tool now has a file-based surface agentsmesh could own natively.
- You are tightening an existing capability: making a generate-only `native` feature actually round-trip.

## Do Not Use This Skill For

- Adding a brand-new target id — use `add-agent-target`.
- First-time global-mode architecture for a target — use `add-global-mode-target`.
- Pure refactors that do not change any capability level.

## Non-Negotiable Rules

### MUST

- **Research the real, current format from primary sources** before touching code: the tool's official docs/changelog, the exact file path, the exact JSON/YAML/Markdown shape, and the exact top-level key. Separate the target product from the assistant runtime (a generated `codex-cli` target ≠ Codex desktop).
- **Decide the level per scope, independently.** Project and global capabilities are separate fields and frequently differ (e.g. Goose MCP is global-only; Rovo Dev hooks/permissions are global-only). Use the level matrix in the checklist: `native` (dedicated file/key), `embedded` (folded into another file), `partial` (tool supports it but only via UI/managed settings agentsmesh cannot write), `none`.
- **Round-trip symmetry is the first-class requirement.** A `native` generate side MUST have a matching import side, or the capability is broken — this is the trap that slips through most often. After wiring a generator, wire the importer (descriptor `importer` block or custom `importFrom`) and assert canonical output in a test. The support matrix says "Native"; users read that as both directions.
- **`partial` requires a no-op generator stub plus a lint warning.** The descriptor schema requires a `generateX` returning `[]` even when the level is `partial`; add a `lint.<feature>` warning (reuse `createWarning`) pointing the user at the tool's UI/settings.
- **Settings-file merge discipline.** If a target emits *multiple* writes to one settings file in a pass (separate per-feature generators, or an array from one emitter), its `mergeGeneratedOutputContent` MUST use `pending?.content ?? existing` as the merge base, never just `existing` — otherwise earlier keys (e.g. `mcpServers`) are silently clobbered. If the target emits a *single combined* write (one `emitScopedSettings` output carrying every key), `_pending` is correctly unused — do not "fix" it.
- **Plugin safety.** The engine resolves every hook via `getBuiltinTargetDefinition(id) ?? getDescriptor(id)` — builtins and plugin descriptors share the path. If you change a descriptor hook *contract* (new field, new hook), update `tests/fixtures/plugins/rich-plugin` and add a registered-plugin-descriptor test, not only builtin coverage. If you merely *use* an existing hook, no fixture change is needed.
- **No target-name hardcoding in shared/core.** Extend shared infrastructure with data-driven, optional, default-preserving fields (e.g. `mcpServersKey?` on the mcpJson import mode), never `if (target === 'x')` branches.
- **Write failing tests first** for every new behavior: generator/emitter edge cases (`null`, empty, valid, each of allow/deny/ask), strict contract path arrays, and global-layout capability assertions.
- **Keep every file ≤ 200 lines.** Capability wiring grows `index.ts`; split into `capabilities.ts`, `importer-spec.ts`, `layout.ts`, `merge.ts`, `settings.ts` as the existing targets do. Check `wc -l` after wiring.
- **Reference rewriting.** If you add a new generated directory that contains cross-references (e.g. a commands dir), register it in `src/core/reference/import-maps/<target>.ts` both directions, and confirm the prose-vs-link classifier still holds.
- **Keep target data single-source.** Capabilities live only in the descriptor; the matrix builds dynamically. Run the matrix regen and sync README + `website/src/content/docs/reference/supported-tools.mdx` (the single per-target support page).
- **Run the lessons ritual.** Recall before each file edit / state-changing command; capture immediately after any failure or correction.
- **Run `post-feature-qa`** before claiming done.

### MUST NOT

- Do not declare `native` and ship generate-only — that is a broken round-trip, not a feature.
- Do not infer the format from old fixtures, the README, or memory.
- Do not add a generator for a feature the tool only manages in its GUI — that is `partial`, with a lint warning.
- Do not let `index.ts` cross 200 lines "temporarily."
- Do not update README without the website page, or vice versa.
- Do not hand-edit `package.json` version or the matrix tables; they are generated.

## Workflow

Run this with `superpowers:subagent-driven-development` when touching more than one target/feature — one implementer subagent per (target, feature), each under `superpowers:test-driven-development`, followed by the two-stage review below. One target/feature per implementer; never parallel-edit the same target.

1. **Research** — record the exact path, format, top-level key, and per-scope support level. Resolve every unknown from primary sources before coding.
2. **Decide levels** — set `capabilities` and `globalSupport.capabilities` independently using the level matrix.
3. **Tests first** — generator/emitter edge cases, strict contract arrays, global-layout capability assertions; for round-trip, a generate→import equality test.
4. **Implement the descriptor wiring** — constants (project + global), generator OR `emitScopedSettings` OR `mergeGeneratedOutputContent`, capabilities, `managedOutputs`, `rewriteGeneratedPath`, the **importer** (round-trip), and the `partial` lint stub. Reuse shared helpers (`buildClaudeHooksObjectFromCanonical`, `createWarning`, `mergeSettingsJson`).
5. **Split for size** — extract to keep every file ≤ 200 lines.
6. **References + docs** — wire import-maps if new ref-bearing dirs were added; run `pnpm schemas:generate && pnpm matrix:generate`; sync README + supported-tools page.
7. **Review (two-stage, read-only Explore subagents)** — first spec compliance (does it match the researched format + scope levels + round-trip?), then code quality (no `any`, explicit return types, ≤ 200 lines, helper reuse, no shared hardcoding). Fix and re-review until both pass.
8. **Double-check pass** — verify the four cross-cutting contracts explicitly: round-trip symmetry, settings-merge base, plugin safety, and matrix/README/website agreement. See the checklist's "Double-Check" section.
9. **Changeset + QA** — add a `minor` changeset (new capability is a backward-compatible feature); run `post-feature-qa`; run the full verification stack.

## Required Verification

Before claiming completion, every command must pass:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm matrix:verify`
- `pnpm build` (integration/e2e need the built dist)

Run narrower target-scoped tests while iterating, but do not skip the full stack at the end.

## Completion Standard

The task is not done until all of the following are true:

- The new level is declared in the descriptor for each scope it applies to, and `pnpm matrix:verify` passes.
- Generate **and** import are both covered by tests for every level raised to `native`; round-trip preserves content where the format permits.
- `partial` features have a no-op generator stub and a lint warning verified by tests.
- Multi-write settings files merge with a `pending?.content ?? existing` base; single-combined-write mergers are left untouched.
- No file exceeds 200 lines; no target-name branch was added to shared/core.
- Plugin path holds (rich-plugin fixture updated only if a hook contract changed).
- README matrix and the website supported-tools page agree with the descriptor.
- A `minor` changeset exists; `post-feature-qa` has been applied and any gaps closed.
- The full verification stack passes.