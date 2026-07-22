# Recurrence Escalation package (lessons feature)

Audit-approved plan (2026-07-21): session+rank threading → advisory recurrence
escalation on PreToolUse → curation of unreachable lessons. TDD throughout.

- [x] 1. TDD outcome-log: explicit `session` param wins over env in
      recordDelivered/recordFailure; `rank` stamped per delivered event
- [x] 2. TDD hook-emit: emitRecall threads options.sessionId into recordDelivered
- [x] 3. TDD hook: failure branch threads stdin session_id into recordFailure
- [x] 4. TDD recall: recordRecallTelemetry accepts session; recallLessons passes
      options.sessionId (recall-log records finally carry session)
- [x] 5. Split captureLesson out of recall.ts → capture.ts (226 > 200-line cap;
      updated importers: mcp/handlers/lessons.ts, cli/lessons-write-handlers.ts,
      public barrel, 3 integration tests) — recall.ts now 182 lines
- [x] 6. TDD recurrence-gate.ts (new): coveringRules/hasCoveringLesson moved from
      hook.ts; recurrenceEscalation (threshold ≥2, covered, once per key per
      session, cheap outcomeLogExists gate)
- [x] 7. TDD hook wiring: PreToolUse escalation preface via emitRecall `preface`
      (emitted even when recall fully deduped); PostToolUse unaffected
- [x] 8. Line counts ≤200: hook 196, hook-emit 115, outcome-log 200,
      recurrence-gate 102, recall 182, capture 54
- [x] 9. Suite green: unit+integration 899 files / 10,600 tests; e2e 82 files /
      639 tests; tsc + eslint clean
- [x] 10. Curation: verification lesson now fires on focused `vitest run tests/`;
      release-changesets lesson reachable via `git log v` cmd + `changeset` kw
      (5 remaining keyword-only lessons are honestly conceptual — left as-is)
- [x] 11. Docs: cli/lessons.mdx (PreToolUse recurrence gate, session stamping),
      reference/lessons.mdx (rank/session fields, 4th consumer), README hook
      sentence; astro build + link validation green
- [x] 12. Adversarial review: 0 confirmed defects (bugs reviewer thorough; the
      flagged telemetry-gating edge adjudicated as intended reads-free design);
      contracts dimension re-run directly → CLEAN across all 7 checks;
      post-feature-qa closed 4 test gaps (clearSeen sentinel reset, corrupt
      graph, 2-rule cap, command-path escalation)
- [x] 13. Lessons captured: subagent-delegation-in-workflow-scripts-treat-every,
      subagent-delegation placeholder-degeneracy rule; final suite
      899 files / 10,604 tests green

# Follow-up: trigger width ("both", 2026-07-21)

- [x] A. Capture-time trigger repair (opt-in `repairTriggers` config):
      trigger-repair.ts (narrow broad/wide globs toward evidence file class,
      keyword variants, drop dead keywords; never blocks, never blind-rewrites),
      wired in captureLesson; isBroadGlob exported; 3 new GuardrailCodes;
      config scaffold + docs updated; 15 new tests; full suite 900 files /
      10,619 + e2e 82/639 + tsc + eslint + astro green. NOT enabled in this
      repo — permission gate requires the user to flip `repairTriggers: true`.
- [x] B. Consolidation proposal (tasks/lessons-consolidation-proposal.md), all
      3 clusters drafted + independently verified: generation-collision PASS
      (7 rules ← 16); windows-paths PASS after 1 regex-corruption fix (8 rules
      ← 16 + 8 leftovers); link-rebaser PASS on all 25 replacements after
      restoring rule-26's regex literal + cross-cluster ownership note for
      windows-paths-rule-10/14/16 (7 rules ← 25 + 4 leftovers). Awaiting user
      review before any lessons add/deprecate is applied.
