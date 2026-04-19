# Senior Architectural Review — agentsmesh

**Date:** 2026-04-19
**Reviewer role:** Senior library architect, TypeScript/CLI/codegen
**Scope:** Full repository — target system, generation/import pipelines, testing, docs, release surface.
**Objective:** Identify the highest-leverage changes to make this library scale to more targets, more contributors, and more platforms without regressing reliability. Keep additions simple, keep the contract explicit, and keep verification strict.

Companion documents:
- `docs/architecture/add-target-template.md` — canonical structure for adding a new target (project + global).
- `docs/architecture/testing-strategy.md` — layered testing strategy with per-target contract matrix.
- `docs/architecture/implementation-tasks.md` — phased work items for mid-tier models.

---

## 1. Executive summary

agentsmesh is in a strong architectural position. The target model is **interface-first**, the canonical directory is a **clear source of truth**, and the generate/import pipelines already share cross-cutting infrastructure (reference rewriting, link rebasing, lock file, collision detection). The test suite is sizeable (~290 files, ~52 KLOC), coverage gates are enforced, and there is a deliberate separation between CLI e2e (spawn `dist/cli.js`) and in-process engine tests.

The main risks are **drift** risks, not design flaws:

1. **Per-target special cases leak into shared code** — `src/core/lint/*`, `src/core/reference/rewriter.ts`, `src/core/generate/engine.ts` all contain hardcoded target-name branches (`'codex-cli'`, `'copilot'`, `'cursor'`, `'gemini-cli'`, `'windsurf'`). This breaks the "edit one folder to add a target" contract.
2. **Duplicated per-target helpers** — five targets have their own `*-skills-helpers.ts` doing near-identical agent/skill import normalization. Bugs fan out five times (lessons 89, 90 show exactly this).
3. **Feature variance hides in the type system** — `TargetGenerators` has most methods optional; a new target can silently ship missing a generator. `generateWorkflows`/`generateSettings`/`generatePermissions` are target-specific escape hatches that should be modeled as capability variants.
4. **Global mode logic is metadata-heavy but scattered** — `rewriteGeneratedPath`, `mirrorGlobalPath`, `renderPrimaryRootInstruction`, `globalCapabilities`, `globalDetectionPaths`, `generateScopeExtras` are six independent extension points with no single checklist the code enforces.
5. **Docs/matrix sync is manual** — `README.md` and `website/.../supported-tools.mdx` transcribe `SUPPORT_MATRIX` by hand. Nothing fails CI when they drift.
6. **Test pyramid shape is good, but per-target duplication is high and watch flakiness is chronic** — ~101 per-target unit files following the same skeleton; `lessons.md` lists ≥6 watch-timing incidents.

None of these are hard to fix. They are the "pay-the-taxes-you-deferred" list that will determine whether the next 10 targets cost 10× the first 10 or 2×.

---

## 2. What the architecture gets right

Preserve these — any refactor must not regress them.

1. **`TARGET_IDS` as canonical enum** (`src/targets/catalog/target-ids.ts`). Every lookup funnels through the catalog; no target-id string literal should exist outside `src/targets/<id>/` and the catalog.
2. **`TargetDescriptor` as a self-describing plugin** (`src/targets/catalog/target-descriptor.ts`). Everything a target needs — capabilities, layouts, generators, importer, detection paths, lint rules — is one object. This is what makes plugin support realistic.
3. **Canonical single-source-of-truth** (`.agentsmesh/`). Rule 1 of the repo. Defended by lint rules and reinforced by `MEMORY.md`-style lessons.
4. **Separate `project`/`global` layouts on the descriptor.** Scope is data, not code. Keep it that way.
5. **Reference rewriting as middleware**, not per-target concern. `src/core/reference/link-rebaser.ts` + `rewriter.ts` is the only place that knows how paths translate.
6. **Lock file with feature-level checksums.** Team collaboration, merge detection, and CI drift detection all flow from one source.
7. **Strict generated-artifact test assertions** (lesson 83). "Exact file path, exact count, exact referenced set" is the correct contract for generated output.
8. **Skills + references/ tree as canonical content.** `.agentsmesh/skills/add-agent-target/` already encodes the add-target workflow; the workflow is itself versioned and reviewable.

---

## 3. Findings and recommendations

Each finding has a severity, location, rationale, and recommendation. Severities:
- **S0** — blocks scale: must fix before the next target is added.
- **S1** — compounding debt: fix in the next minor release.
- **S2** — nice to have: roadmap item.

### 3.1 Hardcoded target names in shared code (S0)

**Location:**
- `src/core/lint/commands.ts`, `src/core/lint/mcp.ts`, `src/core/lint/permissions.ts` — literal `'cursor'`, `'copilot'`, `'gemini-cli'`, `'junie'`, `'windsurf'`, `'continue'`, `'codex-cli'` checks.
- `src/core/reference/rewriter.ts:26,39,70` — `CODEX_CLI` constant; `.agents/skills/` hardwired to codex's artifact map; `.github/instructions/` special cache key for copilot.
- `src/core/generate/engine.ts:101` — Gemini settings generation branch.

**Why it breaks scale:** Every new target requires editing files outside `src/targets/<id>/`. The lesson log already names this failure mode (lesson 95 — "target feature expansion must update both rewrite path maps and import scanners").

**Recommendation:**
1. Move per-target lint branches into the target descriptor as small `targetLint.*` predicates. Example: `descriptor.lint.mcp?(canonical) → LintDiagnostic[]`.
2. Move "this target owns the shared `.agents/skills/` artifact" into a descriptor flag: `descriptor.sharedArtifacts?: { readonly 'skills': 'owner' | 'consumer' }`. The rewriter selects the owner from the active target set rather than a string constant.
3. Route copilot's `.github/instructions/` via a descriptor-declared "output family" — see 3.6.
4. Delete the Gemini engine branch by making `generateSettings` a first-class optional generator in `TargetGenerators` and gating it on the descriptor's `capabilities.settings` (introduced in 3.3 below).

**Acceptance:** `rg -n "'codex-cli'\|'copilot'\|'cursor'\|'gemini-cli'\|'windsurf'\|'junie'\|'continue'" src/core` returns zero production-code hits.

---

### 3.2 Duplicated agent/skill import helpers (S0)

**Location:** Five nearly-parallel files:
- `src/targets/copilot/agents-skills-helpers.ts`
- `src/targets/cline/skills-helpers.ts`
- `src/targets/cursor/skills-helpers.ts`
- `src/targets/codex-cli/skills-helpers.ts`
- `src/targets/windsurf/workflows-skills-helpers.ts`

**Why it breaks scale:** Lesson 90 spells this out directly: *"Shared importer rules belong in shared code, not copy-pasted per target. Windsurf had the same hidden/fixture scoped-AGENTS.md and stale `_ab-agent-*` cleanup bug right after Codex because both targets implemented parallel importer logic separately."*

**Recommendation:** Extract a single `src/targets/import/shared/skill-import-pipeline.ts` with:
- `readNativeSkill(dir, options)` — produces canonical skill body + frontmatter.
- `stripReservedArtifactNames(entries, reserved)` — handles `_ab-agent-*`, `_ab-command-*`, hidden files, scoped root duplicates. Shared list of reserved patterns.
- `normalizeProjectedAgentSkill(content, kind)` — the agent↔skill projection used by Cline, Windsurf, Gemini.

Each target's importer shrinks to a ~30-line adapter that binds its layout to the pipeline.

**Acceptance:** The five `*-skills-helpers.ts` files are deleted or reduced to a single `import * as pipeline from '../import/shared/skill-import-pipeline'` and a thin adapter ≤50 lines.

---

### 3.3 Feature variance in `TargetGenerators` (S0)

**Problem:** `generateCommands` vs `generateWorkflows` (Cline, Windsurf), `generateIgnore` vs `generateSettings` (Gemini), `generatePermissions` as a rare escape hatch. These are not unique features — they are **different serializations of the same canonical feature**. The type system currently models them as extra optional methods, which lets a new target ship with none of them.

**Why it breaks scale:** A new Windsurf-like target must either name its generator `generateCommands` (wrong word) or add `generateWorkflows` to the interface (cluttering it for everyone else). Reviewers cannot tell at a glance which canonical feature an extra method corresponds to.

**Recommendation:** Keep `TargetGenerators` strictly canonical — exactly one method per canonical feature (`rules`, `commands`, `agents`, `skills`, `mcp`, `permissions`, `hooks`, `ignore`, `settings`). Encode the serialization choice as a capability flavor on the descriptor:

```ts
capabilities: {
  commands: { level: 'native', flavor: 'workflows' },
  ignore:   { level: 'native', flavor: 'settings-embedded' },
  ...
}
```

A target's `generateCommands` receives the canonical command list plus the flavor; it decides whether to emit `.cursor/commands/*.md` or `.windsurf/workflows/*.md`. The flavor is the only place where serialization variance lives.

**Acceptance:** `generateWorkflows`, `generateSettings`, `generatePermissions` are all deleted from `TargetGenerators`. Matrix, docs, and lint all read flavor from one place.

---

### 3.4 Global-mode extension points are scattered (S1)

**Six independent hooks** a global-enabled target can plug into:
- `descriptor.global: TargetLayout`
- `descriptor.globalCapabilities`
- `descriptor.globalDetectionPaths`
- `layout.rewriteGeneratedPath`
- `layout.mirrorGlobalPath`
- `descriptor.generateScopeExtras`

Nothing in the type system requires that adding global mode sets all six. Lessons 13, 113, 114, 118 all describe forgotten hooks.

**Recommendation:** Introduce a single shape that a global-capable target opts into:

```ts
interface GlobalTargetSupport {
  readonly capabilities: TargetCapabilities;
  readonly detectionPaths: readonly string[];
  readonly layout: TargetLayout;
  readonly scopeExtras?: ScopeExtrasFn;
}

interface TargetDescriptor {
  ...
  readonly globalSupport?: GlobalTargetSupport; // mutually exclusive with bare fields
}
```

Keep backward compatibility for one minor; deprecate the six bare fields. The TypeScript type now rejects partial global support.

**Acceptance:** Adding global mode touches exactly one descriptor block; a missing sub-field fails `tsc`.

---

### 3.5 Matrix / README / website drift (S1)

**Problem:** `README.md` and `website/src/content/docs/reference/supported-tools.mdx` are hand-transcribed from `SUPPORT_MATRIX`. No CI gate; lesson 62 documents a real drift incident.

**Recommendation:**
1. Author the README matrix via a `<!-- agentsmesh:support-matrix --> ... <!-- /agentsmesh:support-matrix -->` block generated from `SUPPORT_MATRIX` by a dedicated codegen script (`scripts/render-support-matrix.ts`).
2. Add a CI check: `pnpm matrix:verify` regenerates the block into a tempfile and diffs against README and the MDX page. Drift → non-zero exit.
3. Do the same for the global matrix and for the flavor annotations introduced in 3.3.

**Acceptance:** Touching a target's capabilities and forgetting the doc update fails CI with a clear diff message.

---

### 3.6 Output-family registry (S1)

**Problem:** Copilot emits two output families (`.github/copilot/*.instructions.md` and `.github/instructions/*.md`) from one canonical rule. Lesson 75 describes the "per-output rewrite map" fix. Currently the rewriter handles this via a hardcoded `.github/instructions/` check.

**Recommendation:** Formalize the concept. Each target declares its output families:

```ts
outputs: {
  primary: { rootKind: 'native', ... },
  compat:  { rootKind: 'mirror', basePath: '.github/instructions/', ... },
}
```

The rewriter builds a rewrite map per family automatically. Cursor's `AGENTS.md` + `.cursor/AGENTS.md` mirror also moves into this model, deleting `additionalRootDecorationPaths` as a bare field.

**Acceptance:** No target-id string in `src/core/reference/rewriter.ts`.

---

### 3.7 Hidden list duplication: detection paths (S1)

**Problem:** `descriptor.detectionPaths` + `descriptor.globalDetectionPaths` are owned by each target; the init command re-assembles them. This is fine now, but duplicates the target IDs list when combined with the lint branches (3.1). A single target can advertise detection paths; lint can ask the descriptor what it expects.

**Recommendation:** Add one small helper — `collectDetectionPaths(scope): readonly {target, path}[]` — in the catalog. Every consumer (init, doctor-like diagnostics, integration tests) uses it. Remove every ad-hoc detection-path list in CLI commands.

**Acceptance:** `rg -n "detectionPaths" src/cli src/targets/catalog` shows one producer and one consumer per scope.

---

### 3.8 Library export surface (S2)

**Problem:** The package ships CLI-only. Integrators (CI actions, IDE extensions, website codegen) currently shell out to `dist/cli.js`. Lesson 56/57/58/60 all describe test-time friction that would disappear if the engine were importable.

**Recommendation:** Add a thin, **typed** public surface:

```ts
// package.json "exports"
"./engine":   "./dist/engine.js",
"./canonical":"./dist/canonical.js",
"./targets":  "./dist/targets.js"
```

Only expose:
- `generate(config, canonical, opts): Promise<GenerateResult[]>`
- `importFrom(target, opts): Promise<ImportResult[]>`
- `loadCanonical(root): Promise<CanonicalFiles>`
- `getTargetCatalog(): readonly TargetDescriptor[]`
- Types only — no re-export of internal helpers.

Document the stability level. Consumers that currently spawn the CLI can migrate; integration tests gain instrumentation coverage.

**Acceptance:** `tsup` emits three entry points; `typesVersions` locks the surface; a smoke test imports and uses each entry from a built tarball.

---

### 3.9 Plugin registry (S2)

**Problem:** `src/targets/catalog/registry.ts` already supports runtime registration but is unused. Targets are compile-time only.

**Recommendation:** Document the plugin contract as an **exported type** (via 3.8) and add one integration test that loads a mock target via `registerTargetDescriptor`. Don't ship a discovery mechanism yet; keep the contract real but deliberately closed until 12→20+ targets demand it.

---

### 3.10 Per-target test boilerplate (S1)

**Problem:** ~101 per-target unit files, ~7 per target, largely following the same shape. A change to the generator contract touches many near-identical files. Lessons 122–126 describe exactly the pattern of "tests drift from API" under structural refactors.

**Recommendation:** Replace most per-target unit tests with a single **parametrized contract matrix** driven by `TARGET_IDS`. Each target supplies one fixture and one expected contract file; the matrix exercises generate, import, roundtrip, reference-rewrite, global mode, and collision behavior. Per-target files remain only for genuinely unique behavior (Gemini TOML policies, Copilot GitHub Actions hooks).

Full details in `docs/architecture/testing-strategy.md`.

**Acceptance:** Adding a new target adds ~2 files under `tests/` (fixture + contract), not ~7.

---

### 3.11 Watch test harness (S1)

**Problem:** `tests/unit/cli/commands/watch.test.ts` and its integration twin are responsible for the majority of the project's historical flakiness (lessons 18, 28–29, 33–34, 60, 61, 111).

**Recommendation:** Extract a `tests/harness/watch.ts` helper with four guarantees:
1. Per-test temp directory (`randomBytes(6)`) — no shared `ab-watch-cmd-test`.
2. Chokidar `ready` awaited before first assertion.
3. Ignore-list covers `.agentsmesh/.lock`, `.agentsmesh/.lock.tmp`, **and** the parent directory event.
4. `vi.waitFor` timeout and stability window configurable via env var, default 12s/3s, automatically scaled up under `--coverage`.

All watch tests rebuild on top of this harness. Fix the class of bugs in one place.

**Acceptance:** Running `pnpm test && pnpm test:coverage` twice back-to-back reports zero watch flakes.

---

### 3.12 Large-file compliance (S2)

**Problem:** Project rule is ≤200 lines per file. `src/core/reference/import-map-builders.ts` is 421 LOC. `src/targets/gemini-cli/generator.ts` is ~243 LOC, Codex/Cursor ~237 LOC. (Lesson log does not exempt these.)

**Recommendation:** Split `import-map-builders.ts` into `per-target/*.ts` files, one per target, with a tiny aggregator. Split the three big target generators by feature (`rules.ts`, `commands.ts`, `agents.ts`, …). This is mechanical and unlocks diff-review speed.

**Acceptance:** No file in `src/` exceeds 200 LOC (excluding generated).

---

### 3.13 Canonical contract tests (S1)

**Problem:** `.agentsmesh/` format (rules, commands, agents, skills, mcp, hooks, permissions, ignore) is documented in prose but not as a schema test fixture. When the canonical shape grows (lesson 15 warned about exactly this), targets silently tolerate invalid files.

**Recommendation:** Promote `canonical-full` and `canonical-minimal` fixtures to **canonical format snapshots** — one assertion per feature ensuring the fixture is a valid specimen of the current schema. When schema changes, the snapshot must be updated intentionally.

---

## 4. Priority and sequencing

The only true blockers for scale are in **§3.1, §3.2, §3.3**. Everything else is compounding debt. Suggested sequence:

1. **Week 1 (mid-tier model work, isolated):** §3.1 target-name sweep, §3.2 shared skill helpers, §3.12 file splits. All deterministic, all testable with existing suites.
2. **Week 2:** §3.3 capabilities flavor, §3.4 `globalSupport` shape, §3.6 output-family registry. These change the descriptor shape; do them together, under one deprecation window.
3. **Week 3:** §3.5 matrix sync CI, §3.7 detection-path helper, §3.10 parametrized contract matrix, §3.11 watch harness.
4. **Roadmap:** §3.8 public library export, §3.9 plugin hardening, §3.13 canonical contract snapshots.

Each phase is implementable without breaking downstream consumers if deprecations are kept for one minor release. See `docs/architecture/implementation-tasks.md` for work items at mid-tier-model granularity.

---

## 5. Non-goals (deliberately not changing)

- **CLI command surface.** The eleven commands are well-scoped. Don't add a new one to fix an internal shape issue.
- **Canonical directory layout.** `.agentsmesh/` is the contract. Any change here is a major.
- **Locking model.** Feature-level checksums + merge strategy is correct; the rest of the review is compatible with it.
- **Fixture discipline.** Realistic fixtures stay mandatory (skill `add-agent-target` is correct on this).
- **TDD-first, strict assertions.** Preserved everywhere; see testing strategy doc.

---

## 6. Open questions for the maintainer

1. Is a plugin ecosystem a near-term goal, or should the public export stay CLI-first? (Affects 3.8, 3.9.)
2. Are Cline/Windsurf "workflows" a genuine distinct feature or strictly a commands flavor? (Affects 3.3 — wording only.)
3. Does the team want the matrix docgen to live in-repo (`scripts/`) or in `website/`? (Affects 3.5.)
4. Is there appetite for a `--strict` CLI flag that short-circuits all "partial" support and refuses to generate when the canonical data would silently drop fields? (Could ride on 3.3.)

Answers unblock the exact task wording in `implementation-tasks.md`.
