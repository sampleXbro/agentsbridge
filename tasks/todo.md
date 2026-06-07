# Lessons recall improvements — measurement + reachability

Scope (user-approved): **(A) recall-frequency measurement** and **(B) conceptual-lesson
reachability**, both **inside the per-action recall model** (no session-preload redesign).
Out of scope: usefulness-signal/aging (deferred precision work), ReDoS-engine review.

Principles: TDD first (failing test → implement). All files ≤200 lines. CLI paths forward-slash
normalized. No `any`. Docs (README + website + CLI help) updated before "done". `post-feature-qa`
after each item. Single recall chokepoint = `recallLessons()` in `src/lessons/recall.ts:55`.

Sequencing: **A lands first** — it is the instrument that proves the per-action model is/ isn't
token-justified AND measures whether B actually helps. B lands second, measured by A.

---

## Item A — Recall-frequency measurement ✅ (instrument, then read the numbers)

**A6 verdict (this corpus: 233 active lessons, 193 triggers, 25-action replay):** no-match 32%;
returned tokens p50/p90/max = 150/365/382 (budget 400 holding); cumulative recall 4,148 vs
whole-active-set preload 16,321 → **per-action recall cheaper** (ratio 0.25; preload only wins past
~98 recalls/session). Keyword-only-unreachable lessons = 2 (small but dark on mandatory recall →
bounds Item B's payoff here). Caveat: replay (file/cmd supplied), not organic telemetry.


**Why:** payload is already lean; the unmeasured cost is recall *frequency* (mandatory query before
every edit/command). Need real data: no-match rate, returned-token distribution, cumulative recall
cost vs. whole-active-set cost (the preload alternative), and the keyword-only reachability gap.

**Design — opt-in, zero-cost-when-off telemetry + a pure aggregator + a `stats` command.**

- [x] A1. `src/lessons/telemetry.ts` (new, pure + gated writer)
      - `buildRecallRecord(input)` → one JSONL record: `ts` (caller-supplied ISO), field-presence
        booleans only (`hasFile/hasCommand/hasKeyword`, **never the values** — privacy + size),
        `totalMatches`, `returnedCount`, `returnedTokens`, `truncatedByLimit`, `truncatedByBudget`,
        and per-kind match provenance `matchedByKind: {file,command,keyword}`.
      - `appendRecallRecord(projectRoot, record)` → append one line to
        `.agentsmesh/lessons/recall-log.jsonl`. **Gated**: no-op unless
        `AGENTSMESH_LESSONS_TELEMETRY=1`. Off by default → zero files, zero overhead.
      - Tests: gate off = no file written; gate on = exactly one well-formed line per call; record
        shape; no raw file/command/keyword strings ever serialized.

- [x] A2. Provenance plumbing in `src/lessons/query.ts`
      - Add an optional sibling that returns matched-trigger **kinds** (or a per-kind matched-id set)
        so A1 can fill `matchedByKind` without re-running matching. Hot path stays zero-cost when
        telemetry is off (only compute provenance when enabled).
      - Tests: provenance counts correct for mixed file/cmd/keyword matches.

- [x] A3. Wire one call into `src/lessons/recall.ts`
      - After ranking, when gated on, build + append the record. `recallLessons` already returns
        `totalMatches`; reuse it. Caller passes the timestamp (keep recall.ts side-effect explicit).
      - Tests: integration — N recalls with telemetry on → N log lines with expected fields.

- [x] A4. `src/lessons/stats.ts` (new, pure aggregator)
      - `summarizeRecall(log[], graph)` → `StatsReport`: total recalls, no-match rate,
        match-count histogram, returned-token p50/p90, **cumulative recall tokens** (log window),
        **whole-active-set token cost** (Σ est-tokens of active rules = the preload baseline),
        **break-even verdict** (per-action vs. preload for this corpus), and reachability:
        `% recalls that fired only via keyword`, `% no-match`, and
        `keywordOnlyUnreachable` = count of active lessons whose triggers are all `keyword`
        (invisible to file/cmd-only recall — quantifies the Item B gap).
      - Pure function over arrays → fully unit-testable against a synthetic log. Tests assert each
        metric on a known fixture.

- [x] A5. `agentsmesh lessons stats` CLI subcommand
      - `doStats(projectRoot)` in handlers; dispatch in `lessons.ts`; `lessons-types.ts` data type;
        renderer (compact text + `--json`). Forward-slash-normalize any paths.
      - **MCP surface unchanged** — analysis tool is CLI-only, so no added per-session schema token
        tax on the agent.
      - Tests: handler returns report; renderer text + json; empty-log path = friendly "(no telemetry
        yet — set AGENTSMESH_LESSONS_TELEMETRY=1)".

- [x] A6. Produce the actual numbers
      - Enable telemetry, run/replay a real working session, run `lessons stats`, **record the verdict
        in the PR**: is per-action recall token-justified vs. preload for this corpus? This is the
        deliverable that the whole item exists for.

- [x] A7. Docs: README (new `stats` subcommand + telemetry env var), website `reference/lessons.mdx`
      + `cli/lessons.mdx`, CLI `help-data.ts`. Add `recall-log.jsonl` to lessons `ignore` guidance.

**Acceptance:** telemetry off by default (asserted no-write); one clean record per recall when on;
`stats` reports no-match rate, token histogram, preload break-even, and keyword-only-unreachable
count, all verified on a fixture; real-session numbers captured.

---

## Item B — Conceptual-lesson reachability (engine, single contained change)

**Why:** `triggerMatches` keyword case (`query.ts:80-82`) only tests `query.keyword`. A keyword-only
lesson never fires on a mandatory `--file`/`--cmd` recall unless the agent hand-crafts `--keyword` —
the least reliable input. Whole class of conceptual lessons is systematically under-recalled.

**Chosen approach (query-side derivation) — rejected alternative noted:**
Match keyword triggers ALSO against a haystack *derived from the file path + command*, with
**token/word-boundary** matching. Rejected: auto-deriving keyword triggers at *capture* — pushes
burden to capture, ignores existing lessons, duplicates data. Query-side derivation is strictly
better: zero data change, helps every existing keyword lesson immediately.

- [ ] B1. `src/lessons/keyword-match.ts` (new, keeps query.ts ≤200)
      - `deriveHaystack(query)` → tokens from file path (split on `/ . - _` + camelCase) + command
        (whitespace/punct), lowercased.
      - `keywordMatches(pattern, query)` → true if pattern matches `query.keyword` (current substring
        behavior, **byte-identical**) OR matches the derived haystack on **token boundaries**
        (multi-word patterns must match contiguously; min token len reuses BM25 tokenizer rules to
        avoid noise). Prevents "cat" firing on "category", "test" firing on everything.
      - Reuse the existing tokenizer in `ranking-text.ts` if exported; else extract shared.

- [ ] B2. Swap `query.ts` keyword case to `keywordMatches(...)`. No other match logic changes.
      Bound stays the same (ranking specificity + 400-token budget already cap blast radius).

- [ ] B3. Tests (TDD, write first)
      - keyword "subagent" fires on file `subagent-runner.ts`; "checkout" fires on cmd
        `git checkout -b`; "cat" does NOT fire on `category.ts`; multi-word "read only" matches
        `read-only` segment, not scattered tokens.
      - **Regression**: explicit `--keyword` behavior byte-identical to before.
      - **Ranking preserved**: an exact `file_glob` match still ranks above a derived-keyword match
        (specificity/inverse-fanout intact).
      - e2e: a real keyword-only lesson surfaces on a file-only query.

- [ ] B4. Re-run Item A stats before/after B on the same session → confirm no-match rate drops
      **without** a runaway returned-count (precision check). This is why A ships first.

- [ ] B5. Soften (don't remove) the `KEYWORD_ONLY_LESSON` guardrail message — still a useful signal,
      but no longer "won't surface". Docs: `reference/lessons.mdx` matching section.

**Acceptance:** keyword-only lesson recalled by file-only and cmd-only queries (token-boundary,
proven by tests); no substring-within-word false positives; explicit `--keyword` regression-clean;
specificity ranking still favors precise triggers; A's stats show no-match rate down without
returned-count blowup.

---

## Cross-cutting / done-criteria
- [ ] `post-feature-qa` skill after A and after B.
- [ ] typecheck + eslint + full suite + lessons e2e all green.
- [ ] README + website (`reference/lessons.mdx`, `cli/lessons.mdx`) + CLI help in sync.
- [ ] Commit only when the user asks (conventional commits, no co-author trailer).

---

## Prior round (shipped) — guardrails / prune / ranking rebalance: complete (see git log review rounds 1–5).
