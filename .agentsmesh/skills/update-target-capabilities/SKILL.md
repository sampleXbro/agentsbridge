---
name: update-target-capabilities
description: Use when an AI tool gains support for a feature agentsmesh does not yet expose — or exposes wrongly — and you must raise or correct an existing target's capability for project and/or global scope (rules, additionalRules, commands, agents, skills, mcp, hooks, ignore, permissions). Also use to audit every target for capability gaps, or to act on an audit/feature-request someone else wrote. Start by verifying the claim against the tool's OWN primary docs — such findings are frequently fabricated, stale, or wrong-scoped, so be ready to reject. Covers verification-first research, descriptor wiring, round-trip symmetry, global-only scopeExtras emission, settings-merge and plugin safety, format/path-change blast radius, strict TDD, two-stage review, and matrix/docs sync. Start with `pnpm capabilities:audit`; research only STALE/MISSING cells; the ledger memoizes verified formats so audits stay fast.
---

## Purpose

# Update Target Capabilities

Use this skill when an existing target already lives in `src/targets/<target>/` and the underlying tool has started supporting a canonical feature that agentsmesh declares as `none` (or under-declares as `partial`/`embedded`) — **or** declares as `native` but doesn't actually work (wrong path, wrong key, wrong shape, generate-only with no importer, or a file the tool never reads). The job is to raise or correct that capability — for the right scope(s), with the generate **and** import sides symmetric — and to prove it.

> **The meta-rule: verify the claim before you build it.** Most invocations of this skill act on a *claim* — an audit row, a feature-request, a changelog rumor, or a comment in our own code. In real use, a large fraction of those claims are wrong: the surface is fabricated (no such file exists), already-correct (the claim is stale), wrong-scoped (claimed "both scopes" but the tool only reads it globally), or GUI-only (no writable file → `partial`, not `native`). Treat every claim as a hypothesis and confirm it against the tool's **own** primary docs/source before writing a line. Rejecting a bad finding is a successful outcome — ship a guess and you ship a broken capability the matrix now advertises as real.

This is the skill `add-agent-target` defers to under "changing capability levels for an existing target." Use `add-agent-target` only for a brand-new target id; use `add-global-mode-target` only for first-time global wiring of a target that predates global support.

Read `.agentsmesh/skills/update-target-capabilities/references/capability-update-checklist.md` before editing code. It holds the decision matrices, the format/path-change blast-radius list, and the full touchpoint/test/review list.

## When To Use

- A tool shipped a new feature surface (a config file, a settings key, a hooks format) that agentsmesh does not yet generate or import.
- You are auditing all targets for gaps ("which features do tools now support that we declare `none`?"), or working through an audit/feature-request someone else produced (verify each row — see the meta-rule).
- A capability is declared `partial`/`embedded` but the tool now has a dedicated file surface agentsmesh could own natively.
- A capability is declared `native` but is **broken**: wrong path/key/shape, a file the tool never reads, or generate-only with no importer. Fixing it so the tool actually loads it (or so it round-trips) is in scope and counts as a real capability gain even though the matrix level doesn't move.

## Do Not Use This Skill For

- Adding a brand-new target id — use `add-agent-target`.
- First-time global-mode architecture for a target — use `add-global-mode-target`.
- Pure refactors that do not change any capability level or fix any broken surface.
- Downgrades/removals (`native → none/partial`) — those are breaking changes that need a product decision, not this skill's expansion-first flow.

## Non-Negotiable Rules

### MUST

- **Verify the claim against the tool's own primary docs/source first — and reject what doesn't hold up.** A claim is real only when you can point at the tool's docs/source that say it reads this file/key in this shape at this scope. Reject (and write down why) when you find: a **fabricated** surface (no such file/key exists — e.g. a permissions path the tool never reads); an **already-correct** state (the claim is stale; the current code is right); a **wrong scope** (claimed "both" but the tool only reads it globally, or vice versa); or a **GUI/cloud-only** surface (no writable file → `partial`, not `native`). Do not trust the audit row, *our own code comments*, the README, or memory — they are exactly what produced the wrong claims. A rejection with evidence is a complete, valuable result.
- **Research the real, current format from primary sources** (only after the claim survives verification): the exact file path, the exact JSON/YAML/Markdown shape, and the exact top-level key (`mcpServers` vs `servers` vs `extensions` vs `context_servers` all differ). Separate the target product from the assistant runtime (a generated `codex-cli` target ≠ Codex desktop), and note when a project moved orgs/paths (e.g. Goose → AAIF).
- **Global-only settings-backed features emit via `globalSupport.scopeExtras`, not a plain `generateX`.** The permissions/settings feature loop invokes generators *without* a scope, and `resolveTargetFeatureGenerator` does not gate by level — so a plain `generatePermissions`/`generateX` for a feature that's `native` global but `none` project will **leak the file into project scope**. Emit it from `scopeExtras` (which receives the scope) and gate on `scope === 'global'`; the descriptor schema accepts `scopeExtras` as the implementation of a settings-backed global capability. (MCP/hooks generators *do* receive a `ctx` and can scope-gate via `ctx?.scope`.)
- **When two or more targets share a file format, extract one shared helper instead of duplicating per-target logic** (e.g. the wrapped command-hook serialize/import shared by codex-cli, factory-droid, and goose). Existing targets' tests then prove the extraction is behavior-preserving. Duplicated per-target format logic is the anti-pattern the architecture guide calls out.
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

- Do not implement a claim you could not confirm from the tool's own primary source — reject it with a one-line reason instead.
- Do not declare `native` and ship generate-only — that is a broken round-trip, not a feature.
- Do not infer the format from old fixtures, the README, our own code comments, or memory.
- Do not add a generator for a feature the tool only manages in its GUI — that is `partial`, with a lint warning.
- Do not use a plain `generateX` for a global-only feature — it leaks into project scope (use `scopeExtras`).
- Do not let `index.ts` cross 200 lines "temporarily."
- Do not update README without the website page, or vice versa.
- Do not hand-edit `package.json` version or the matrix tables; they are generated.

## Workflow (audit-driven)

Run `superpowers:subagent-driven-development` when touching more than one (target, feature).

1. **Audit (deterministic, ~0 tokens):** `pnpm capabilities:audit --json`. It joins descriptors × the capability ledger (`src/targets/catalog/capability-ledger.json`) and returns four buckets:
   - **GAPS** — `descriptor < maxAchievable`: raise-opportunities. Do NOT leave these on the table (coverage bias: overstatement beats understatement).
   - **STALE** — provenance is null (seeded but unverified) or older than the window, or the descriptor over-declares vs the ledger: re-verify.
   - **MISSING** — a native/embedded cell with no ledger provenance: research and add an entry.
   - **BROKEN** — surfaced by `pnpm test` (the conformance test): a native/embedded cell whose generated output fails its ledger fingerprint (wrong path / extension / top-level key / shape).
2. **Research ONLY STALE + MISSING** against the tool's OWN primary docs (the §0 verification rules below still apply — reject fabricated / GUI-only / wrong-scope claims). Update the ledger cell's `path`, `ext`, `format`, `fingerprint`, `source` (primary-doc URL), `verifiedAt` (today), `maxAchievable`, and `verdict: "confirmed"`. Never re-research a cell whose provenance is fresh. Directory/projection features (commands, agents, skills) and extensionless ignore files are intentionally unseeded — research those by hand and add cells (or leave `none`).
3. **Fix BROKEN** — correct the generator/importer until `pnpm test` conformance passes for that cell.
4. **Flip GAPS** — for each, follow `references/capability-update-checklist.md` in full (TDD generator + importer, round-trip symmetry, blast-radius). The format is already in the ledger — do not re-research it. A flip to `native` still requires proven generate **and** import; the matrix never advertises an unproven native.
5. **Guard:** `pnpm capabilities:verify` (every native/embedded cell has provenance) + `pnpm matrix:verify` + the full stack.

The ledger is an oracle, not a source of truth: current levels always come from the descriptor (the matrix derives from there); the ledger records where the tool's docs say the file/shape is, so we validate — never generate — against it. Re-run `pnpm capabilities:seed` after adding or changing a native/embedded feature to refresh fingerprint skeletons.

## Fast Execution Playbook

Optimise for zero wasted tokens. Treat each phase as a gate: only enter the next if the previous signals real work.

**Phase 0 — Deterministic triage (~0 tokens).**
Run `pnpm capabilities:audit --json` then the full verification stack (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm matrix:verify`, `pnpm capabilities:verify`), capturing the **real exit codes** — never pipe any of those commands through `tail`/`grep`; a non-zero exit masked by the pipeline is the single most common source of false-green audits. If the audit returns 0 gaps, 0 stale, 0 missing, 0 broken **and** all verification passes, **stop** — there is nothing to do.

**Phase 1 — One pipelined pass per target.**
Work only the targets that appear in the gaps/stale/missing/broken buckets or in the current diff. For each such target, execute research → primary-doc verification → ledger update → descriptor fix as **one uninterrupted unit of work**. Do not split into separate "research wave" then "fix wave" — that forces redundant diff re-reads and doubles context. Assignment rules:
- Shared cross-cutting test suites (layout-metadata, agents-folder-structure-research, skill-mirror, reference-rewrite matrix, e2e content contracts) each get **exactly one owner target** designated up front; other targets import from or assert against that owner's output rather than duplicating coverage.
- Verify majors (level raises) once with primary-doc evidence; verify criticals (round-trip symmetry claims, scopeExtras gating, multi-write merge base) twice — run the test and re-read the generator path to confirm the gate is actually reached.
- Ledger cell `path`, `ext`, `format`, and `fingerprint` values MUST be derived from the conformance fixture's actual generated output — not from docs. Docs determine `maxAchievable`, `verdict`, and `source` only.

**Phase 2 — Single-writer close.**
After all per-target fixes are in, merge ledger provenance in one pass, then run `catalog:generate` → `matrix:generate` sequentially. Follow with exactly **one** full-stack run: `pnpm test` to completion, then `pnpm test:e2e` — never concurrent with a build, never interleaved. If any command fails, diagnose before retrying; a second blind retry without root-cause analysis wastes more context than it saves.

## Required Verification

Before claiming completion, every command must pass:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build` — **before** any e2e/round-trip run. The e2e matrix spawns the built `dist/cli.js`; the in-process contract test does not. If the contract round-trip passes but the e2e fails with a missing/extra/relocated file, the dist is stale — rebuild, don't chase the importer.
- `pnpm test`
- `pnpm matrix:verify`
- `pnpm capabilities:verify`

Run narrower target-scoped tests while iterating, but do not skip the full stack at the end. (Note: a few test runs rewrite `tests/e2e/agents-last-run.md` as a side effect — `git checkout --` that file before committing so it doesn't ride along.)

## Completion Standard

The task is not done until all of the following are true:

- Either the claim was **confirmed** from the tool's own primary source and implemented, or it was **rejected** with a one-line evidence-backed reason — never implemented on faith.
- The new level is declared in the descriptor for each scope it applies to, and `pnpm matrix:verify` passes.
- Generate **and** import are both covered by tests for every level raised to `native`; round-trip preserves content where the format permits.
- Global-only features emit via `scopeExtras` (not a project-leaking `generateX`), gated to `scope === 'global'`, with project scope staying `none`.
- `partial` features have a no-op generator stub and a lint warning verified by tests.
- Multi-write settings files merge with a `pending?.content ?? existing` base; single-combined-write mergers are left untouched.
- Every output path/format change is reflected in all blast-radius sites (contract arrays, e2e exclusion sets, both `reference-targets` chains, `dirTreeExactly`, layout/matrix tests) — verified by a tree-wide grep for the old string.
- No file exceeds 200 lines; no target-name branch was added to shared/core.
- Plugin path holds (rich-plugin fixture updated only if a hook *contract* changed).
- README matrix and the website supported-tools page agree with the descriptor.
- A changeset exists at the right level — `minor` for a new capability (level raise), `patch` for a same-level fix that makes an existing `native` claim actually work. `post-feature-qa` has been applied and any gaps closed.
- The full verification stack passes.
