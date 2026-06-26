# Lessons feature — feedback analysis & gap-closing strategy

**Date:** 2026-06-26
**Status:** Workstream A in progress (recurrence harness). B/C/D scoped, not started.
**Companion:** `docs/architecture/flows/lessons.md` (recall/capture flow), the
`lessons` skill (`.agentsmesh/skills/lessons/`), and the BLOCKING gate in
`CLAUDE.md`.

This document structures the community feedback received on the lessons feature,
separates signal from noise, names the real gaps, and lays out the strategy to
close them. It is the design record behind Workstream A (the recurrence harness).

---

## 1. Feedback, structured by signal

| # | Core claim | Signal |
|---|------------|--------|
| 1 | **Retrieval trigger**: hook-on-path vs. trusting the model to ask. "Telling the agent the same thing every session" pain. | High |
| 2 | **Staleness**: a lesson about a command that changed 3 months ago is *worse* than no lesson. | High |
| 3 | Contracts > implementations; tests-as-documentation; TDD. | Medium (one usable kernel) |
| 4 | **Authorship integrity**: single-party authorship — the same loop state that caused the failure decides what to remember. Plus: planted faults to verify the *right* lesson fires at recurrence, separate from the proposed/approved/deprecated lifecycle. | Highest |
| 5 | **Two-gate model**: admission gate ("may this enter memory?") vs. operational-protection gate ("will it fire at recurrence?"); both required, neither inferable. Harness refinements: decoys authored *outside* the validator's distribution; precision AND recall in *both* directions. | Highest |
| 6 | Token-priority flagging during thinking → inject graph entries for flagged tokens; "waterfall" drill-down replacing grep. | Low (kernel only) |
| 7 | Markov chain over "most unique word" as the relevance key. | Discard |

### Discarded as unsound (#6, #7)
- "Most unique word via Markov" conflates *surprisal* with *relevance*; a bigram
  model does not separate boilerplate from instruction, and is noisy and
  non-reproducible.
- The token-flag "waterfall" is embedding/semantic recall re-described; the claim
  that it is "free because cache hits" is wrong — injecting matched entries every
  loop grows the context window monotonically regardless of KV-cache reuse.
- **Kept kernel:** semantic/salience recall as a *complement* to explicit
  file+cmd triggers — implemented as embedding similarity over the working
  context, not Markov surprisal. Tracked under Workstream D, gated behind the
  harness so it must *prove* it improves precision/recall, not just add noise.

### Kept kernel from #3
"Rely on contracts, not implementations" maps onto staleness: lessons keyed to a
**contract** (a flag's meaning, an invariant) outlive lessons keyed to an
**implementation** (a specific command string). A capture-quality rule, tracked
under Workstream C.

---

## 2. The real gaps (deduped)

- **G1 — Trigger determinism.** Pre-edit recall is instruction-gated; the model
  can skip it. (The `PostToolUse` `agentsmesh lessons hook` is post-action
  telemetry/capture, not a pre-edit block.)
- **G2 — Staleness.** Pruning exists (`auto-prune.ts`, `prune.ts`,
  `validate-liveness.ts`); no signal proves a *surviving* lesson still matches
  reality.
- **G3 — Authorship integrity.** The failing loop authors its own lesson →
  systematic blind spots, over-general or self-justifying rules.
- **G4 — Operational protection (the gap).** No proof the *right* lesson fires at
  recurrence. The lifecycle answers admission, not protection.
- **G5 — Bidirectional precision/recall.** No measured false-positive rate on
  adjacent contexts where a lesson *should not* fire — the exact risk the original
  post named.

---

## 3. The spine: two orthogonal gates

| Gate | Question | Mechanism | State |
|------|----------|-----------|-------|
| **Admission** | "May this enter memory?" | `status` lifecycle (`active`/`deprecated`/`superseded`) + capture guardrails | Mostly built |
| **Protection** | "Will it fire at recurrence & stay silent elsewhere?" | Planted-fault recurrence harness | **Workstream A** |

Both are required; neither is inferable from the other. Conflating them is how a
lessons system quietly becomes a well-formed **write-side artifact** that is never
verified at the operational layer.

---

## 4. Workstreams

### A — Protection gate / recurrence harness (closes G4 + G5) — **first**
A controlled **suite** = a fixture `LessonsGraph` + a set of **cases**. Each case
is a recall context (`file`/`command`/`keyword`) labelling every lesson as either
**should-fire** (planted fault) or **should-stay-silent** (decoy / adjacent
negative / deprecated). The harness runs the **real ranker**
(`queryLessons` → `rankLessons`, both pure) against the fixture graph, capped to
top-N, and measures **both directions**:
- **recall / catch rate** = planted lessons retrieved in top-N (TP / (TP+FN));
- **false-positive rate** = decoy/adjacent lessons wrongly retrieved (FP / (FP+TN));
- **precision** = TP / (TP+FP).

**Commenter #5's two hard constraints, satisfied structurally:**
1. *Decoys authored outside the validator's distribution.* The suite graph is a
   test fixture — validated for **shape only** (`parseGraph`), **never** run
   through the graph-quality validator (`validate-quality.ts`/`validate-checks.ts`).
   So the harness measures **retrieval discriminability**, not graph hygiene.
2. *Precision AND recall in both directions.* Enforced by a **complete-labeling**
   invariant: every case must classify every lesson as expected XOR forbidden, so
   no lesson is unlabeled and the false-positive direction is always measured.

**Deliverable:** pure engine (`src/lessons/recurrence/*`) + a fixture suite + a
CI-gated integration test asserting exact per-case retrieval sets and thresholds.
The gate is a **test** (runs in existing `pnpm test`), not a new CLI command — the
architecture review (§5) cautions against CLI-surface growth.

**A.2 — second instrument over the REAL graph (built + measured, 2026-06-26).**
"Telemetry-derived precision/recall" was an overclaim: `recall-log.jsonl` has no
ground-truth labels, so it yields operational *health* stats, not precision/recall.
The genuinely deterministic instrument is a **static reachability audit**
(`src/lessons/reachability.ts`): per active lesson, is it `file-reachable` (a
file_glob matches the working tree — verified), `command-pattern` (a valid
command_pattern — reachability vs real commands is NOT statically verifiable; keep
this tier SEPARATE from file-reachable), `keyword-only`, or `inert`.

Results on this repo's 358 active lessons: **76.0% file-reachable, 23.5%
command-pattern, 0.6% keyword-only, 0% inert.** Globs are overwhelmingly narrow
(144/179 match ≤10 files); only 12/272 file-reachable lessons rely solely on a
broad glob, so the figure is not breadth-inflated. Telemetry (2083 recalls,
disjoint partition): 41% no-match, 48% matched-but-all-deduped, 11% delivered;
file-edit queries had only 5.8% no-match. **Verdict (corrected): in this graph the
lessons are NOT write-only artifacts — 0 inert, capture guardrails keep it healthy.
My earlier "I'd bet they're partly inert" was wrong.** Limits the instruments do
NOT measure: whether a delivered lesson is *obeyed/effective*, and whether the
23.5% command-patterns match the commands agents actually run.

### B — Authorship integrity (closes G3)
Two-party capture: a second pass sees only the **evidence** (diff, error, sha) and
independently proposes the principle; divergence from the in-loop proposal flags
an over-fit lesson. Rides on `capture-guardrails.ts`. The harness in A is the
backstop that catches a bad lesson regardless of who authored it.

### C — Staleness as a measured signal (closes G2)
A **liveness probe** (`validate-liveness.ts` is the seam): periodically re-resolve
each lesson's referenced file/flag/command; mark **stale** when the referent is
gone or its contract changed. Bias capture toward contract-level triggers (the
kernel from #3). A stale-but-still-firing lesson is the "worse than nothing" case
(#2) — the harness in A also surfaces it as a false positive.

### D — Trigger determinism (closes G1) — **determinism core SHIPPED (2026-06-26)**
Pre-edit recall is no longer instruction-gated. `buildRecallHookOutput`
(`src/lessons/hook.ts`) is now event-aware — it echoes the harness's
`hook_event_name` and injects matching lessons via `hookSpecificOutput.additionalContext`,
so the same `agentsmesh lessons hook` command works as a **PreToolUse** hook that
guards the FIRST touch (injects BEFORE the edit, no blocking) or a PostToolUse
fallback. The scaffold (`recall-hook-scaffold.ts`) now wires BOTH events; session
dedup keeps a lesson injected at most once. Verified unit + e2e; corrected the
docs that wrongly claimed PreToolUse can't inject context (it can — primary-source
verified). **Deferred:** embedding similarity as an additional ranking signal in
`ranking-signals.ts` (the kept kernel from #6/#7) — a separate, heavier effort
(needs an embedding model), to be admitted only if it moves the harness number.

---

## 5. Recommendation & sequencing

**Build Workstream A first and alone.** Everything else (authorship checks,
staleness probes, embedding recall, `PreToolUse`) is unfalsifiable until catch-rate
and false-positive-rate can be measured against planted faults. The harness is
both the deliverable #4/#5 asked for *and* the instrument that tells you whether
B/C/D help.

**Sequence:** **A → C → B → D**, with the bidirectional precision/recall number
from A as the gate every later workstream must move (or at least not regress).
