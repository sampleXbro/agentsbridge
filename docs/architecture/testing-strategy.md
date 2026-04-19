# Testing Strategy — agentsmesh

**Date:** 2026-04-19
**Status:** Proposed. Supersedes scattered test guidance in `CLAUDE.md` and `tasks/lessons.md`. Does not replace the repo's TDD rule.

This strategy describes what we test, at what layer, with what fidelity, and how we prevent regressions as the target count grows. It assumes the architectural recommendations in `docs/architecture/review.md` are in scope.

---

## 1. Principles

1. **Contract over implementation.** A target's contract is "which files it generates, which canonical it imports, which diagnostics it emits". Tests assert the contract, not the code path.
2. **One canonical layer for cross-cutting behavior.** Reference rewriting, collision detection, lock file, scope resolution — tested once, in isolation, against a synthetic target harness. Per-target tests never re-verify the framework.
3. **Parametrize over targets.** If a test would be copy-pasted per target, it belongs in the **target contract matrix** instead.
4. **Strict assertions, every layer.** Exact paths, exact counts, exact referenced artifact sets. Loose checks (`some(...)`, prefix-only, "at least one") are forbidden — lessons 83, 84, 88, 92 already cost us this.
5. **Realistic fixtures, not synthetic placeholders.** Every feature that takes a path, a link, or a reference must be exercised from a fixture that resembles a real user project.
6. **Verify in process and through the CLI binary.** Coverage comes from in-process tests; contract safety comes from CLI e2e. Neither substitutes.
7. **Rebuild before dist-backed tests.** `pretest: pnpm build` is not optional.
8. **Isolation first, parallelism second.** Fresh temp directory per test, per fixture. Never parallelize anything that touches `dist/`, `.agentsmesh/`, HOME, or a watched path.

---

## 2. Test pyramid — target shape

| Layer | Count | Purpose | Runtime | Coverage-eligible |
| --- | --- | --- | --- | --- |
| Unit — framework | ~120 files | Core pipeline, canonical loader, reference rewriter, link rebaser, lock, merge, install, config schema | Fast (<5s each) | Yes |
| Unit — per-target **unique** | 1–2 per target | Target-specific serializers, formatters that don't fit the matrix | Fast | Yes |
| Contract matrix | 1 file | Parametrized over `TARGET_IDS` × features × scope | Medium | Partial (in-process helpers) |
| Integration | ~30 files | Full CLI commands via `execSync dist/cli.js` | Medium | No |
| E2E | ~30 files | Cross-target flows, install, extends, watch, collisions | Slow | No |
| Roundtrip & golden | ~5 files | canonical↔target bi-directional fidelity | Medium | Partial |
| Manual smoke | script | One-command validation before release | — | No |

**Target shape:** unit-heavy base, narrow-but-comprehensive matrix middle, thin but strict e2e top. The contract matrix is the load-bearing layer — it replaces ~70% of today's per-target unit files.

Today's shape is valid but wide at the unit layer due to per-target duplication. Move mass from per-target unit files into the contract matrix.

---

## 3. The target contract matrix (load-bearing)

Located at `tests/contract/target-contract.matrix.test.ts`. One file, parametrized over `TARGET_IDS`.

### 3.1 Inputs per target

Each target supplies:
- `tests/contract/fixtures/<target-id>/canonical/` — realistic `.agentsmesh/` tree.
- `tests/contract/fixtures/<target-id>/native-project/` — realistic native tool layout.
- `tests/contract/fixtures/<target-id>/native-global/` — realistic `~` layout (if global supported).
- `tests/contract/contracts/<target-id>.ts` — exact file lists, exact dropped fields, exact lint messages.

Nothing else. No per-target test logic.

### 3.2 Assertions per target (for each scope it supports)

1. **Generate path contract.**
   `generate(canonical)` returns exactly the files listed in `contracts.generated[scope]`. Exact path, exact count, no extras, no omissions.
2. **Generate content contract.**
   Every generated file parses under its declared format (Markdown+frontmatter / JSON / TOML / YAML / plain). A shared `parseShape(path, content)` helper enforces this.
3. **Reference rewrite — forward.**
   Generated files contain zero `.agentsmesh/` path tokens. Every `./rel/path` link resolves to a real generated file.
4. **Reference rewrite — reverse.**
   `import` produces canonical files whose links use `.agentsmesh/...` form (no native paths leak back into canonical).
5. **Roundtrip fidelity.**
   canonical → generate → import → canonical: byte-equal for fields the target can represent. For fields the target cannot represent (§3.3 of the add-target template), the field **must survive** (preserved from the existing canonical; lesson 88).
6. **Lint diagnostics.**
   For each `droppedFields` entry in the contract, lint emits the exact warning. Running lint on a canonical with none of those fields returns zero diagnostics.
7. **Stale cleanup.**
   Pre-seed a stale generated artifact that the current descriptor no longer emits. Generate. Assert the stale artifact is gone (lesson 89).
8. **Collision clean-up.**
   If this target shares an output path with another target (e.g., `AGENTS.md`), run both in the same project and assert either dedup succeeds or a clean error names both targets.

### 3.3 Why this replaces per-target unit files

Today's ~7 per-target unit files largely re-express these eight contracts in hand-written prose. A single parametrized matrix achieves the same coverage with:
- Less code.
- One place to upgrade the contract when the framework evolves (e.g., when `TargetCapabilities` gains a `flavor`).
- Automatic coverage for new targets.

Per-target unit files remain only for genuine uniqueness — Gemini's TOML policy encoder, Copilot's GitHub Actions hook JSON, Codex's TOML MCP config. Each of those is ≤1 file, ≤200 LOC.

---

## 4. Framework unit tests

Framework unit tests are **target-agnostic**. They use a mock target descriptor (`tests/harness/mock-target.ts`) with a minimal layout.

Mandatory coverage:

| Subsystem | Must-cover cases |
| --- | --- |
| Canonical loader | all eight features, malformed frontmatter, missing file, extend merge, local-only override |
| Reference rewriter | absolute / relative / `./` / `../` / over-traversal / home-relative / URI / code block / inline code / Windows drive letter (lessons 78, 79, 80) |
| Link rebaser | same-directory descendants preserve `./` (lesson 9); nested-root-rule mirror (lesson 7) |
| Collision | identical content dedup; differing content errors with both target names; mirrored artifacts normalize before comparison |
| Lock file | checksum, feature-lock, merge marker detection, extend-version drift |
| Install pipeline | pack materialization incl. mcp/permissions/hooks/ignore (lesson 47); sync replay with narrowed scope (lesson 102) |
| Config schema | every enum value; every default; local override precedence |
| Watcher | `ready` awaited; lock file ignored including parent event (lessons 33, 34); per-test temp dir |

Each framework unit test runs in <500ms. Total framework suite <30s.

---

## 5. Integration layer

Purpose: prove the CLI **binary** produces the same outputs as the in-process engine. This is the compliance layer.

Rules:
- Always `pnpm build` before the suite runs (enforced by `pretest`).
- Always spawn `dist/cli.js` — never the source.
- Always use a fresh temp directory and `HOME`/`USERPROFILE` override when touching global mode.
- Never run integration tests in parallel with e2e (shared `dist/`, lessons 58–60).
- Shell defaults to `/bin/sh` — never `/bin/zsh` (lesson 24).

Scope: one integration test per CLI command (`generate`, `import`, `install`, `watch`, `lint`, `check`, `diff`, `merge`, `init`, `matrix`) exercising a realistic project and asserting exit code, stdout contract, and at least one generated/imported artifact. Do **not** re-test per-target here — that's the matrix's job.

---

## 6. E2E layer

Purpose: verify flows the contract matrix cannot — multi-command sequences, extends, installs, watch-under-load, migrations.

E2E tests run under `vitest.e2e.config.ts` with `sequence.concurrent: false`. Add a new e2e test only when the flow crosses commands or depends on filesystem state accumulated across commands. Examples that belong here:

- `install → generate → import → generate` preserves install-scoped features.
- `extends` remote with cache hit / miss / offline.
- `watch` under a rapid edit burst; no self-trigger loops.
- Migration path: project canonical → `init --global` → `generate --global` produces parity output.
- Multi-target global: all global-supported targets in one HOME produce no collisions.

Single-target contract verification is **not** e2e; it's matrix.

---

## 7. Roundtrip and golden tests

Roundtrip is part of the contract matrix (§3.2.5). **Golden** tests are a thin superset: they store a tiny byte-equal snapshot for a handful of representative generated files per target. Use them only when:
- The format is fragile (TOML key ordering, JSON trailing newline).
- Human-readable review of the file is worth the snapshot cost.

Goldens go in `tests/contract/goldens/<target-id>/`. Regenerate via `pnpm test:goldens:update`. CI rejects un-reviewed regeneration via a commit-time guard.

---

## 8. Watch-test harness

All watch tests — unit, integration, e2e — must route through `tests/harness/watch.ts`. The harness guarantees:

1. Per-test temp directory (`randomBytes(6)`; never shared).
2. `await chokidar.on('ready')` before any assertion or CLI invocation.
3. Ignore glob includes `.agentsmesh/.lock`, `.agentsmesh/.lock.tmp`, and the **parent** `.agentsmesh` directory event.
4. `vi.waitFor` timeouts default to 12 000 ms, stability delay 3 000 ms, both scaled ×1.5 when `process.env.COVERAGE === '1'`.
5. Automatic teardown kills watchers before removing the temp dir.

Adding a new watch assertion outside the harness is an automatic review rejection.

---

## 9. Coverage strategy

Current thresholds: lines 90 / functions 90 / branches 84. Target: branches 87 within two minor releases.

- **Thresholds are per-file-folder**, not global. `src/core/reference/`, `src/core/generate/`, `src/targets/catalog/`, `src/config/` each carry their own threshold block.
- **Excluded paths are justified in comments**. Every exclusion carries a one-line justification and a linked issue if it represents a known gap (lesson 53).
- **Integration and e2e don't contribute to coverage** — don't chase branch numbers by porting tests there. Port them into framework unit tests with the mock target.
- **Uncovered branches must be listed in `tasks/coverage-gaps.md`** (new file). CI refuses to decrease coverage.
- **Coverage runs on every PR touching `src/core/*`, `src/targets/*`, or `src/config/*`**. Other PRs (docs, scripts) can skip with a labeled `ci:skip-coverage`.

---

## 10. Flake budget

Flake is a leading indicator of a test design bug, not a test runner bug. Lessons 18, 28–29, 33–34, 56, 60, 111 all describe single incidents of **shared state** or **unbounded timing**.

Policy:
- A test that fails once in 200 runs on main is a bug. Open an issue, attach the incident, fix within one minor.
- A test that fails once in 50 runs is a P0. Revert or quarantine within 24 hours.
- Quarantined tests live under `tests/quarantine/` and count against the team. Zero quarantined tests at release time.

A simple `scripts/flake-check.ts` runs the full unit + contract matrix 20× locally and reports any non-determinism before a release.

---

## 11. Sequencing rules

- **Parallel unit / contract tests:** allowed, default vitest concurrency.
- **Parallel integration tests:** forbidden. Shared `dist/`.
- **Parallel e2e:** forbidden. Config-enforced via `sequence.concurrent: false`.
- **Never mix** targeted vitest runs with `pnpm test:e2e` in one shell — the build steps race `dist/` (lesson 59).

If a user needs to run a single e2e file fast, the supported command is `pnpm build && vitest run --config vitest.e2e.config.ts tests/e2e/<file>`.

---

## 12. Author-time commands

A minimal, memorable set:

| Command | Use |
| --- | --- |
| `pnpm test` | Full unit + contract + integration + e2e (via pretest build) |
| `pnpm test:unit` | Framework + per-target unique units only |
| `pnpm test:contract` | The target contract matrix alone |
| `pnpm test:integration` | CLI-binary integration suite |
| `pnpm test:e2e` | E2E suite (rebuilds, runs sequentially) |
| `pnpm test:watch` | Vitest watch for unit + contract |
| `pnpm test:coverage` | Same as `test` with instrumentation and thresholds |
| `pnpm matrix:verify` | README + website matrix drift check (see review §3.5) |
| `pnpm flake:check` | 20× repeat of unit+contract (pre-release) |
| `pnpm test:goldens:update` | Regenerate goldens (manual audit required) |

Every command is documented in `README.md` under a "Testing" section.

---

## 13. What to do when tests find a real bug

1. Reproduce with the smallest targeted test first.
2. Write the failing test under the **lowest** layer that reproduces it — ideally framework unit or matrix.
3. Fix the root cause in a single PR. No "temporary" fixes.
4. Add a one-line entry to `tasks/lessons.md` capturing the failure, root cause, and preventative rule.
5. If the class of bug could recur across targets, lift the check into the harness or the matrix (§3, §8).

This is the same rule the repo already runs on; this strategy doc makes it explicit.

---

## 14. Non-goals

- Mutation testing — deferred until branch coverage sustained ≥ 90%.
- Property-based testing of target generators — tempting but high-cost; revisit when a new flavor is introduced.
- Contract testing against real live tools (e.g., running Cursor to validate output) — kept as a manual pre-release smoke via a separate Playwright-style script, not CI.

---

## 15. Acceptance — strategy is "in force" when

- [ ] Contract matrix exists and all 12+ current targets pass.
- [ ] Each target has ≤ 2 per-target unique unit files.
- [ ] All watch tests route through the harness.
- [ ] `pnpm matrix:verify` blocks merges on doc drift.
- [ ] `tasks/coverage-gaps.md` exists and is shorter than 20 lines.
- [ ] No new target PR is accepted without the contract entry.
- [ ] Lessons log has net-new entries only for novel failure classes — duplicates indicate a harness gap to fix.
