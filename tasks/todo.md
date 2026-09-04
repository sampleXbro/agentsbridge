# Coverage gate fix (2026-09-04)

Problem: 95% thresholds are aggregate (a 0%-covered 200-line module moves the
number ~0.25%); `src/**/index.ts` is blanket-excluded although the CLI parser
and all 33 target descriptors live there; category (4)/(6) exclusions hide real
branching. Goal: an honest gate that fails on an untested module.

- [x] 1. Baseline: full coverage run with json-summary; rank files by lowest
      lines/branches/functions within the current include set
- [x] 2. Measure the excluded set: re-run coverage with `index.ts` and the
      category (4)/(6) files included; list what falls under 95%
- [x] 3. Decide gate shape: `perFile: true` at a defensible floor per metric
      (target 95 lines/functions, branches floor from data) plus the global 95
- [x] 4. TDD the gaps: add unit tests for logic-bearing `index.ts` files and
      any pulled-in module below the floor; only re-exclude genuine
      types-only barrels, listed by name (no glob)
- [x] 5. Guard against `.only` (eslint rule) so the gate cannot be bypassed
- [x] 6. Full `test:coverage` green; `pnpm typecheck` + lint green; docs note
      in vitest.config.ts categories updated; lessons capture

# Website redesign (2026-09-04)

Direction: "signal on graphite" — precision-instrument look. Amber accent on
graphite (dark) / warm paper (light). Bricolage Grotesque display, IBM Plex
Sans body, IBM Plex Mono code (self-hosted via fontsource). Signature element:
animated SVG mesh (one source -> many targets) in the hero. Minimal copy.

- [x] 1. Tokens + fonts: `src/styles/tokens.css` (Starlight var overrides, both
      themes), fontsource deps, wire `customCss` in astro.config.mjs
- [x] 2. TDD `src/lib/install-command.mjs` (shared by hero + catalog) and
      `src/lib/mesh-layout.mjs` (node positions for the hero diagram)
- [x] 3. Hero override (`components.Hero`): eyebrow, H1, tagline, CTAs from
      frontmatter + install snippet (brew/curl/npm, copy) + `MeshDiagram.astro`
- [x] 4. Homepage sections as small Astro components fed by
      `src/content/data/home.ts`: HowItWorks, SyncGrid, LessonsLoop, ToolWall
      (wraps the script-owned tool-list marker block), GoDeeper
- [x] 5. Rewrite `index.mdx` with terse copy; keep tool-list markers verbatim
- [x] 6. Catalog explorer: restyle to tokens, use shared install-command,
      shorter labels; keep virtual table behaviour
- [x] 7. Docs chrome: header, sidebar, TOC, headings, code frames, tables,
      asides, cards, pagination — `src/styles/docs.css`
- [x] 8. Responsive pass in Chrome DevTools at 375 / 768 / 1024 / 1440, light +
      dark, homepage + 3 docs pages; console clean; Lighthouse a11y
- [x] 9. `node --test`, `astro build` (link validator), `pnpm matrix:verify`
      still green; post-feature-qa; lessons capture

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

# Follow-up: field-review improvements ("all of it", 2026-07-21)

- [x] S1 P0-CLI: `--session auto` in doQuery (env → project-namespaced day
      key); autoSessionId in seen-cache; guards split to lessons-query-guards
- [x] S2 P0-MCP: lessons_query session/no_dedup/'no-dedup' inputs; dedup ON by
      default (env → mcp-<pid>); handler split to mcp/handlers/lessons-query;
      suppressed in output; frozen-API golden deliberately updated (3 deltas)
- [x] S3 P0-ritual: both ritual query commands carry --session auto; old
      wording added to LEGACY_RAW_FORMS ladder; skill manual updated;
      compactness cap 900→950 (functional flag, not prose)
- [x] S4 P1: stats-advice.ts (inert-dedup + cmd-starvation diagnoses, silent
      by default) + LessonsStatsData.advice + text/JSON rendering
- [x] S5 P3+P5: nudge pre-fills escaped command CLASS for --trigger-cmd +
      RULE_SHAPE_HINT ("cite the symptom; say why the obvious fix is wrong")
- [x] S6 P4: cmd-fastpath.ts (tmpdir cache, graph-stamp freshness, telemetry
      parity, commandCouldMatch engine parity) wired in hook + recallLessons;
      lazy loadEffectiveness on empty matches
- [x] S7: docs (cli+reference lessons.mdx) + astro green; full suites green;
      (P2 = field-deployment advice; no code — gate + threading already shipped)
- [x] S8 review round: 18 confirmed findings, all fixed —
      F1 fast-path stamp race (pre-read stamp + equality gate, race test);
      F2 auto day-bucket → 4h TTL'd v2 seen store (seen-store.ts split);
      F3 MCP correlator per-lifetime nonce (pid-reuse resurrection);
      F4 CLI correlator threaded into recall telemetry (day-key shape pinned);
      F5 nudge quote-fragment fallback; F6 unconditional project namespacing;
      F7 advice excludes always-scope triggers; + 8 must-add test gaps closed
      (self-priming, kebab alias, advice rendering ×3, boundary ×2, strict
      parity record, vacuous nudge test, fastpath/escalation interplay).
      Final: 903 files / 10,663 unit+integration; 82/639 e2e; tsc; eslint;
      astro; all caps ≤200.

# New-chat suppression gap (2026-08-27)

Reported by the user: "chat 1 for an hour, then a NEW chat on the same files —
are lessons still hidden?" Verified with the real CLI: YES for non-hook agents,
because `--session auto` fell back to a whole-day key with a 4h entry TTL.
Hook-capable targets were already fine (fresh harness session_id per chat).

- [x] 1. Idle reset — new src/lessons/session-window.ts; a 30-min gap with no
      deliveries resets the WHOLE session (seen empty + stamps dropped so
      commitSeen cannot resurrect them). Derived from the newest stamp, so no
      on-disk format change.
- [x] 2. Ceiling 4h -> 1h (AUTO_SESSION_TTL_MS); MCP inherits both bounds.
- [x] 3. SessionStart `startup` now wipes the CLI auto bucket via
      clearSeenForSessionStart (compact/clear unchanged, resume still keeps).
- [x] Split for the 200-line cap: seen-cache 174, session-window 58, hook 195.
- [x] Docs + changeset updated (30-min reset, 1h ceiling, startup reset,
      --no-dedup residual escape). Full stack green: 903 files / 10,672 tests,
      82/639 e2e, tsc, eslint, astro, lock in sync.
- [x] Verified end-to-end on the real CLI: chat 2 immediately = still
      suppressed (documented residual); after a 31-min pause = rule back;
      after SessionStart(startup) = rule back.
- [x] Adversarial review of the new logic (14 agents): 11 confirmed / 1 refuted;
      all fixed:
      * compact/clear never cleared the auto bucket — SAME bug class the user
        reported (rules hidden from a compacted context for up to 1h). Policy
        rewritten: `resume` is the ONLY source that keeps the set; everything
        else (incl. unknown/missing source) clears BOTH the harness store and
        every correlator key the CLI/MCP could have used.
      * idle heuristic measured last DELIVERY, so a busy session with everything
        suppressed re-delivered the whole set every 30 min → store now records
        `lastAt` activity on empty commits too (optional field, back-compatible).
      * MCP `always:true` path opened dedup with no session and no TTL →
        unbounded suppression of always-on lessons; now bounded like the rest.
      * future-dated stamp (clock skew) pinned an entry forever → treated as
        infinitely old (safe direction) with 60s jitter tolerance.
      * stale hooks doc + stale hook.test.ts title/assertion corrected.
- [x] Verified compaction fix on the real CLI: after /compact the rule is
      delivered again; after `resume` it correctly stays suppressed.

# Uncommitted-change review + fixes (2026-08-27)

- [x] Senior review of the uncommitted field-improvement set: 20-agent panel
      (3 dimensions + refute verify) → 12 confirmed / 5 refuted; plus my own
      gate + artifact-integrity audit (all green, lock in sync)
- [x] FIX seen-store downgrade: commitSeen now follows the shape it READ, so an
      untimed writer can no longer strip stamps and zero out `--session auto`
      dedup (reproduced live before/after; 2 tests)
- [x] FIX MCP dedup blocker: suppression is now bounded by AUTO_SESSION_TTL_MS
      (RecallOptions.ttlMs threaded); the server has no compaction signal, so
      unbounded dedup could hide a rule for the whole server lifetime (1 test)
- [x] Changeset .changeset/lessons-session-correlator.md (minor) covering the
      whole track incl. the MCP default-change callout
- [x] README ritual updated to `--session auto` (docs-currency rule)
- [ ] OPEN (reported, not fixed): nudge emits over-broad single-token command
      classes (`rm -rf x` → `--trigger-cmd 'rm'`, matches "npm" unanchored);
      6 test-strictness gaps (fast-path↔queryLessons parity, TTL deletion-proof,
      vacuous MCP deprecate test, nudge round-trip, LEGACY_RAW_FORMS strip, skill
      ritual text)

# Consolidation proposal review (2026-08-27)

- [x] Deterministic audit: 36 orphaned files (windows-paths generator surface),
      lost cmd/kw surfaces, 4 rules over token budget, no dead globs, no
      normalized-rule collisions; absorb targets identified per lost surface
- [x] Judgment panel + refute verify (32 agents): 22 confirmed / 8 refuted;
      6 blockers incl. simulation-proven delivery regressions in all 3 clusters
      and shell-apply corruption of 21/22 rules
- [x] Verdict stamped into proposal doc: DO NOT APPLY AS WRITTEN; v2 constraints
      captured as lesson lessons-system-validate-any-lessons-graph-consolidation

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

---

# Target capability sweep (2026-08-30)

Full primary-source re-verification of all 30 targets × 9 features × 2 scopes.
Ledger went from 305 unverified cells to 0 missing provenance; `capabilities:verify`
passes for the first time.

## Shipped

- [x] **gemini-cli** — stop writing `.gemini/policies/permissions.toml` at project scope
      (Gemini documents the Workspace policy tier as non-functional). Permissions now
      emit only from `globalSupport.scopeExtras`; project scope gets a lint warning.
      Extracted `layout.ts` to bring `index.ts` back under 200 lines.
- [x] **amazon-q** — `commands: none -> native` at both scopes via `.amazonq/prompts/<name>.md`
      and `~/.aws/amazonq/prompts/<name>.md` (generator + importer + lint + ledger).
- [x] **claude-code** — global hooks moved from the fabricated `~/.claude/hooks.json`
      into `~/.claude/settings.json` under `hooks`.
- [x] Ledger: 162 cells given verified provenance (path/ext/format/key/source/date/verdict).

## Backlog — 38 evidence-backed GAPS (`pnpm capabilities:audit`)

Each has a primary-source URL in `capability-ledger.json`. Highest value first:

- continue: agents + hooks, both scopes (hooks are Claude-Code-compatible)
- zed: rules global (`~/.config/zed/AGENTS.md`), permissions global
      (`agent.tool_permissions`), ignore both (`file_scan_exclusions`/`private_files`)
- antigravity: agents both, mcp project, ignore project, permissions global
- warp: rules + additionalRules global (`~/.agents/AGENTS.md`), permissions global,
      ignore project (`.warpindexingignore`)
- trae permissions global; kiro permissions both; pi-agent permissions both;
      augment-code permissions project; crush ignore global; goose mcp project;
      amazon-q ignore/additionalRules; aider hooks; opencode ignore;
      deepagents-cli permissions global; replit-agent commands/agents project

## Backlog — 24 over-declared cells (matrix overstates; needs a product call)

Notably: `goose ignore` (`.gooseignore` retired upstream, PR #10359),
`rovodev hooks global` (no documented config key), `kilo-code hooks` (plugins are
code, not config), `aider mcp` (no MCP client at all), `amp`/`factory-droid` ignore
(no ignore concept), `claude-code ignore` (embedded in `permissions.deny`, not a file),
`zed permissions project` (project settings drop the `agent` key).

## Separate issue

kilo-code appears to have rebased on an opencode-style `kilo.jsonc` schema at
`kilo.ai`; the target still models the older `.kilocode/` VS Code layout.
