# Lessons feedback — strategy doc + Workstream A (recurrence harness) — CURRENT

Community feedback on the lessons feature converged on one gap: the graph is
verified **write-side** (well-formed, recallable) but not **operationally** (does
the *right* lesson fire at recurrence, and stay silent on adjacent contexts).
Two-gate model: **admission gate** (status lifecycle, exists) vs **protection
gate** (planted-fault recurrence harness — this task).

### Strategy doc
- [x] `docs/architecture/lessons-strategy.md` — feedback analysis, two-gate
      model, four workstreams, sequencing, Workstream A design.

### Workstream A — recurrence harness (TDD-first)
Pure engine over the existing pure ranker (`queryLessons` → `rankLessons`), run
against a **controlled fixture graph** (never the real graph, never the
graph-quality validator → measures discriminability, not hygiene).
- [x] Recall gate: `lessons_query` for every path/command group.
- [x] `src/lessons/recurrence/types.ts` — case/suite/outcome/metrics/report types.
- [x] `metrics.ts` (+ `tests/unit/lessons/recurrence-metrics.test.ts`) — bidirectional
      micro-averaged precision / recall / false-positive-rate.
- [x] `evaluate.ts` (+ `recurrence-evaluate.test.ts`) — `evaluateCase`
      (real ranker, top-N) + `runRecurrenceSuite`; proves it *detects* a planted FP.
- [x] `suite.ts` (+ `recurrence-suite.test.ts`) — zod schema + invariants
      (complete labeling, disjoint, ids exist, expected=active, unique ids).
- [x] `tests/fixtures/lessons/recurrence/suite.json` — planted faults + decoys +
      adjacent negatives + a deprecated lesson that must never fire.
- [x] `tests/integration/lessons-recurrence.integration.test.ts` — CI gate: exact
      per-case retrieval sets + precision=1, recall=1, fpRate=0, zero regressions.
- NOTE: tests live under `tests/unit/lessons/` (NOT colocated in `src/`) — vitest
  `include` is `tests/**` only; coverage `include` is `src/**`. Lesson captured.

### Verify
- [x] Focused `node_modules/.bin/vitest run` → 25 green; full lessons dir 555 green.
- [x] First-run gate numbers: precision 1.0, recall 1.0, fpRate 0.0 (5 TP / 0 FN / 0 FP / 31 TN).
- [x] Each `src/lessons/recurrence/*.ts` ≤ 200 lines (max 88); 100% coverage; tsc + eslint clean.
- [x] post-feature-qa skill applied.

### Constraints (from recall)
Every `src/lessons/**` file ≤ 200 lines; precision-optimized triggers (narrow
file_glob + keyword); `pnpm exec vitest run <files>`; strict exact-set assertions.

### Step #1 — Harden the harness (make 1.0 mean discrimination) — DONE
Driven by a design fan-out (stressor taxonomy) + an adversarial-review workflow
(refute → triage) + empirical mutation testing.
- [x] Per-case `topN` override (types + schema + evaluate) so discrimination cases
      use a tight cap; loose topN only proves trigger plumbing.
- [x] Multi-suite fixture + `loadSuites`/`parseSuites`: 8 mechanism suites
      (specificity, topic-coherence [matched-subset], truncation+createdAt-tiebreak,
      status-exclusion [deprecated+superseded], multi-trigger max-specificity,
      keyword-semantics [contiguity/substring/stopword], bm25-tiebreak, id-tiebreak).
- [x] Review fixes: topic-coherence now matched-subset + exact-order (was masked by
      `.sort()` and matched-set==corpus); added bm25-tiebreak + id-tiebreak (signals
      that previously survived disabling).
- [x] Suite-level negative control proves the gate reports a leak.
- [x] Mutation testing: 7/7 ranker regressions (specificity/coherence/bm25 weights,
      createdAt + id tie-breaks, stopword filter, status filter) turn the gate RED.
- [x] 51 tests green · 100% coverage · tsc + eslint clean · all files ≤200 lines.

### Step A.2 — second instrument over the REAL graph — DONE
Static reachability audit (`src/lessons/reachability.ts`) + telemetry health summary.
Driven by a design+grounding pass, in-loop TDD, and an adversarial review agent
(which caught the command-vs-glob asymmetry — fixed by splitting the tier).
- [x] `auditReachability` (pure) — tiers active lessons file-reachable / command-pattern
      / keyword-only / inert; reuses canonical predicates (deadFileGlobIds,
      isSafeRegexPattern, keyword liveness). Unit + integration tests, 100% coverage.
- [x] Honest tier split: file-reachable (verified vs tree) ≠ command-pattern (valid only).
- [x] Real-graph finding: 358 active → 76.0% file-reachable, 23.5% command-pattern,
      0.6% keyword-only, **0% inert**. Globs mostly narrow (not breadth-inflated).
- [x] Telemetry (2083 recalls): 41% no-match / 48% deduped / 11% delivered; file-edit
      queries 5.8% no-match. Verdict: lessons here are NOT write-only artifacts.
- [x] 588 tests green · tsc + eslint clean · ≤200 lines · no churn.
- NOT measured (honest limits): lesson EFFECTIVENESS/obedience; whether the 23.5%
  command-patterns match commands agents actually run.

### Step D — deterministic recall (PreToolUse first-touch guard) — DONE
Verified that Claude Code's PreToolUse supports `additionalContext` (primary source) —
the old docs/code wrongly believed it can't, which forced the reactive-only design.
- [x] `buildRecallHookOutput` event-aware: echoes `hook_event_name`, defaults to
      PostToolUse; injects lessons BEFORE the edit when run as PreToolUse.
- [x] `recall-hook-scaffold` injects the recall hook under BOTH PreToolUse + PostToolUse;
      session dedup prevents double-injection.
- [x] Unit + e2e green (incl. real-CLI PreToolUse assertion); 100% line coverage; rebuilt
      dist for e2e; tsc + eslint clean.
- [x] Docs corrected: cli/lessons.mdx (rewrote the false "why not PreToolUse" section),
      README, architecture flow, strategy doc. Lesson captured.
- [x] Adversarial review: ship — Axis-5 (harness portability) is pre-existing (PostToolUse
      already emitted the same JSON to all targets); Post is the documented fallback.
- NOT done (deferred): embedding-similarity ranking signal (separate, needs a model).
- NOTE: not dogfooded into THIS repo's hooks.yaml (would regenerate every tracked target
  artifact — large churn); do `init --lessons`/edit hooks.yaml + `generate` separately.

### Out of scope (noted fast-follows)
`lessons recurrence` CLI subcommand (review §5: avoid CLI-surface growth; gate is a
test) · effectiveness/obeyed instrumentation (needs labeled outcomes) · Workstreams
B (two-party authorship), C (liveness/staleness mostly already in `validate`),
D-embeddings (ranking signal, needs a model).

---

# Capability correction campaign — VERIFIED QUEUE (separate active track)

Source: per-target adversarial verification (`wf_745aa03f-dad`) of the external
audit (`target-capability-audit-2026-06-24.md`) against live code + primary docs.
85 actionable findings, 8 rejected, 13 need-human, 26/30 targets verified.
NOTE: this supersedes the unverified "23 gaps" plan below — verification REJECTED
several of its claims (e.g. Trae commands/agents file-surface; Continue hooks).

## Shipped ✅ (committed on develop)
- [x] factory-droid agents — added importer.agents directory spec (agent preset); native droids now round-trip to `.agentsmesh/agents/*`. commit b2ccc64.
- [x] factory-droid hooks — wrapped `{hooks}` format fix + new importer; extracted shared `wrapped-command-hooks` helper (codex-cli + factory-droid). commit efd0c6f.
- [x] codex-cli hooks `partial → native` (both scopes) — changeset, full QA.
- [x] amazon-q agents `systemPrompt → prompt` key fix (gen + import + fallback) — changeset, full QA.
- [x] cursor hooks format fix — camelCase events + flat array (was PascalCase nested, never fired); round-trip + dropped-event lint warning; changeset, full QA (13-file blast radius).
- [x] amazon-q additionalRules project `none → native` (already emits/imports `.amazonq/rules/<slug>.md`); global stays none (no global rules dir on disk); changeset.
- [x] augment-code rule frontmatter `type` key (was boolean `always_apply`/`agent_requested`); import accepts both; changeset, full QA.

## Corrections from primary-source verification (findings the audit got wrong)
- warp mcp/project: NOT a wrong-path bug — Warp reads `.mcp.json` at repo root too (shared provider path). Leave project as-is. Only warp **global** MCP (`~/.warp/.mcp.json`) is a genuine under-declaration, but it needs global-mode generation wiring (gating + path rebase) — deferred to a focused slice.

## Tier 1 — broken/wrong native (fix-in-place, expansion-safe). HIGHEST PRIORITY.
- [ ] antigravity rules/global path → `~/.gemini/GEMINI.md`
- [ ] antigravity mcp/global path → `~/.gemini/config/mcp_config.json`
- [ ] antigravity hooks shape (named-hook nesting) + ADD importer
- [ ] antigravity skills/global path → `~/.gemini/config/skills/`
- [x] cursor hooks: PascalCase→camelCase events + FLAT array shape — silent no-fire (DONE)
- [ ] cline hooks: filename-IS-event format (`.clinerules/hooks/<EventName>`)
- [ ] warp mcp path → `.warp/.mcp.json` / `~/.warp/.mcp.json`
- [x] augment-code rules frontmatter key `type` (DONE)
- [ ] aider rules: wire `CONVENTIONS.md` via `.aider.conf.yml` `read:`
- [x] copilot hooks/project `partial → native` (`.github/hooks/*.json`) — DONE (round-trip already shipped). Follow-up: copilot GLOBAL hooks native via `~/.copilot/hooks/*.json` (needs global-mode wiring; lesson-confirmed).
- [x] roo-code agents/project `partial → native` — added `.roomodes` importer (round-trip completion); global stays partial (VS Code globalStorage). roo global rules path was ALREADY correct (`~/.roo/rules`) — audit false positive.
- [x] cursor additionalRules `embedded → native` (both scopes) — mislabel; per-rule `.cursor/rules/*.mdc` already round-trips.
- [x] crush global MCP import fix — scope-blind reader now reads `~/.config/crush/crush.json` in global (also fixes global hooks import).
- [x] gemini-cli permissions/global `none → native` — un-suppressed `.gemini/policies/*.toml` in global layout; project stays partial (workspace policies disabled upstream).

## Rejected by recipe-verification (do NOT implement)
- kiro permissions: claimed `~/.kiro/settings/permissions.yaml` (key=rules) is FABRICATED — Kiro permissions live exclusively inside per-agent JSON (allowedTools / toolsSettings). Keep `none`.

## Recipe workflow (wf_c3fdbbf0-b93) produced code-grounded recipes for the next batch:
factory-droid agents (add importer, low) · factory-droid hooks (add importer + format, medium) ·
augment-code permissions/GLOBAL-only (medium; project has no settings.json) · continue permissions/global (medium) ·
goose hooks (new gen+import, medium; delete false lintHooks warning) · factory-droid commands (involved-refactor: skill-projection -> native, last).
- [ ] factory-droid hooks + agents: ADD importer (generate-only today)
- [ ] opencode mcp+permissions settings-merge base; additionalRules via `instructions` key
- [ ] roo-code rules/global path `~/.roo/rules/`
- [ ] kilo-code global paths `~/.config/kilo/*`; mcp key; permissions import
- [ ] amp permissions shape (`amp.permissions`) + import
- [ ] crush permissions shape (`permissions.allowed_tools`)
- [ ] claude-code hooks/permissions settings.json location (verify current emit)
- [ ] codex-cli mcp streamable-HTTP + config.toml merge (P1)
- [ ] deepagents rules/skills global per-agent paths
- [ ] gemini-cli permissions via `.gemini/policies/*.toml`
- [ ] continue rules/global → embedded in `config.yaml`

## Tier 2 — under-declared (none/partial → native, expansion). HIGH PRIORITY.
- [ ] amazon-q additionalRules/project `none → native`
- [ ] cursor additionalRules `embedded → native`
- [ ] pi-agent commands `none → native` — SPEC VERIFIED (earendil-works/pi, prompt-templates.md):
      project `.pi/prompts/<name>.md`, global `~/.pi/agent/prompts/<name>.md`; filename = command name;
      frontmatter `description` + `argument-hint` (both optional); args `$1`/`$@`/`$ARGUMENTS`.
      NOTE: not a clean additive — pi currently PROJECTS commands→skills (commandPath → .pi/skills/.../SKILL.md,
      supportsConversion.commands=true). Native prompts REPLACE that projection: update project+global commandPath
      to `.pi/prompts/<name>.md` / `.pi/agent/prompts/<name>.md`, add a commands importer (directory mode),
      reconsider supportsConversion.commands, update contract + reference map + tests. Medium effort.
      Fix metadata.officialUrl too: real repo is github.com/earendil-works/pi (npm @earendil-works/pi-coding-agent),
      NOT pi-labs/pi-agent.
- [ ] factory-droid commands `none → native`; permissions → embedded
- [ ] goose hooks `none → native`
- [ ] kiro permissions/global `none → native`
- [ ] kilo permissions; warp mcp/global + ignore/project + additionalRules
- [ ] augment hooks/global + permissions; continue permissions/global + commands/global
- [ ] copilot hooks/global + mcp/global; crush mcp/hooks/commands global
- [ ] gemini permissions/global; roo agents/project; deepagents agents; junie hooks/permissions
- [ ] jules mcp `none → partial`
- [ ] trae hooks (LOW confidence — confirm primary source first)

## Downgrades / removals (native→none/partial) — BREAKING, needs decision.
- [ ] claude-code ignore `→ none`; amp hooks `→ none`; cline agents `→ none`
- [ ] aider skills `→ none`; copilot commands/global `→ none`; roo ignore/global `→ none`
- [ ] cline mcp/project `→ partial`; roo mcp+agents/global `→ partial`
- [ ] replit mcp `→ partial`; codex additionalRules/project `→ partial`

## Needs-human (judgement calls)
kiro permissions/project, claude-code frontmatter globs→paths, copilot ignore/permissions,
kilo global read semantics, warp/replit global rules (UI partial?), goose permissions/global,
cline mcp/global path, gemini hooks (partial-emits-file?), junie permissions/project.

## Not yet verified (session limit) — follow-up verification pass needed
qwen-code, rovodev, windsurf, zed

---

# (SUPERSEDED, UNVERIFIED) Prior-session plans below — kept for history

# Top-Tier Target Capability Audit (COMPLETE)

- [x] Read architecture, source-driven development, and post-feature QA guidance.
- [x] Identify the working top-tier target set and current capability maps.
- [x] Verify every working-scope target against current official documentation/source.
- [x] Write failing tests for each confirmed support mismatch.
- [x] Implement confirmed target support changes.
- [x] Regenerate README and website support matrices; update target detail docs.
- [x] Run focused tests, full verification stack, and post-feature QA.

Covered: Claude Code, Codex CLI, Cursor, GitHub Copilot, Gemini CLI, Cline,
Windsurf, Kiro, Continue, OpenCode.

---

# Full Target Capability Audit — Gap Filling (23 gaps across 30 targets)

Full plan: `tasks/plan.md`

## Phase 1: MCP gaps (Goose global + Copilot project)

- [ ] Task 1: Goose MCP — `generateMcp()`, global caps `native`, YAML `extensions` in `~/.config/goose/config.yaml`
- [ ] Task 2: Copilot MCP — `generateMcp()`, project caps `native`, JSON `servers` in `.vscode/mcp.json`

**Checkpoint 1**: `pnpm test && pnpm build` green

## Phase 2: Agent gaps (Augment Code, Amazon Q, Zed skills)

- [ ] Task 3: Augment Code agents — `generateAgents()`, `.augment/agents/*.md` (YAML frontmatter), both scopes `native`
- [ ] Task 4: Amazon Q — `generateAgents()`, `.amazonq/cli-agents/*.json` with inline hooks + permissions; agents `native`, hooks `partial`, permissions `native`
- [ ] Task 5: Zed skills — `generateSkills()`, `.agents/skills/` shared path, Zed as `consumer`, `skills: 'native'`

**Checkpoint 2**: `pnpm test && pnpm build` green

## Phase 3: Permissions & Commands (Junie, Kilo Code, Trae, Warp, Roo Code)

- [ ] Task 6: Junie permissions — `generatePermissions()`, `~/.junie/allowlist.json`, global caps `native`
- [ ] Task 7: Kilo Code permissions — `generatePermissions()`, `permission` key in `kilo.jsonc`, both scopes `native`
- [ ] Task 8: Trae commands — `generateCommands()`, `.trae/commands/*.md`, both scopes `native`; investigate Trae agents
- [ ] Task 9: Warp + Roo Code — declaration-only `permissions: 'partial'` + lint warnings; Windsurf agents confirmed unchanged

**Checkpoint 3**: `pnpm test && pnpm build` green

## Phase 4: Hooks batch (Factory Droid, Deep Agents CLI, Rovo Dev, Antigravity, Qwen Code)

- [ ] Task 10: Factory Droid hooks — `generateHooks()`, `.factory/hooks.json`, 9 events, both scopes `native`
- [ ] Task 11: Deep Agents CLI hooks — `generateHooks()`, `.deepagents/hooks.json`, both scopes `native`
- [ ] Task 12: Rovo Dev hooks + permissions — `emitScopedSettings()`, `~/.rovodev/config.yml`, global `native` for both; project `none`
- [ ] Task 13: Antigravity hooks — `generateHooks()`, `.agents/hooks.json` / `~/.gemini/config/hooks.json`, both scopes `native`
- [ ] Task 14: Qwen Code hooks + permissions — extend `settings.json` emitter; both scopes `native`

**Checkpoint 4**: `pnpm test && pnpm build` green

## Phase 5: Amp (3 gaps) + Antigravity permissions

- [ ] Task 15: Amp commands + hooks + permissions — `generateCommands()`, extend settings.json emitter; check `.agents/commands/` ownership
- [ ] Task 16: Antigravity permissions — declaration `partial`, lint guidance pointing to hooks system

**Checkpoint 5**: `pnpm test && pnpm build` green; all 23 gaps addressed

## Phase 6: Docs & QA

- [ ] Task 17: Regenerate README + website `supported-tools.mdx` matrices for all 23 changes
- [ ] Task 18: Post-feature QA (edge cases, empty inputs, E2E smoke per target)

---

# Lessons Prompt Tightening

- [x] Inspect current lessons source and tests.
- [x] Write failing tests for the lesson gate wording.
- [x] Update the canonical root lesson prompt and managed lessons skill.
- [x] Run targeted verification and post-feature QA.
