# Lessons graph — correctness hardening + effective retrieval (2026-06-06)

Mandate: "fix everything." Decisions: **lightweight BM25 + signals (no embeddings)**; **skip per-lesson retrigger** (ranking carries precision). No graph DB, no LLM extraction.

## Phase 1 — Correctness foundation (bucket A)
- [ ] 1.1 Atomic `saveLessonsGraph` (write temp in same dir → `renameSync` over target). No `.tmp` left behind.
- [ ] 1.2 `mutateLessonsGraph(root, mutator, {retries})` — lock → load(or empty) → mutate → **validate (throw on error-level)** → atomic save. One path for all writers.
- [ ] 1.3 Route add, merge, deprecate(handler), strip-markers through it (deprecate + strip-markers gain lock + validation; strip-markers becomes async).
- [ ] 1.4 `DUPLICATE_RULE` counts **active lessons only** (so merge repairs duplicates).
- [ ] 1.5 Re-capture **upserts** new triggers/evidence/rationale/topics instead of dropping them.
- [ ] 1.6 Migration **fails closed**: if any declared topic file is missing, throw BEFORE deleting legacy artifacts.
- [ ] 1.7 New validate findings: self-supersession, supersession cycle, inactive superseder (error); active+zero-triggers, empty rule (warn/error).
- [ ] 1.8 Fix false "~100–500 tokens" claim in reference/lessons.mdx.

## Phase 2 — Effective retrieval (bucket B + borrowed RRF)
- [ ] 2.1 Scored ranking in query: RRF-fuse BM25(rule text) ⊕ trigger specificity ⊕ recency/usage. Stable tie-break by id.
- [ ] 2.2 `--top N` (default cap) + `--max-tokens` budget + matched-reason in output.
- [ ] 2.3 Compact default output (CLI plain + MCP rule-only; metadata opt-in via --format json).
- [ ] 2.4 Lightweight fields: `usage`/`lastUsed`/`confidence`, `supersededAt`. Bump query usage on recall.
- [ ] 2.5 `lint`/validate warnings: trigger fanout, oversized topic, estimated token cost.

## Phase 3 — Polish
- [ ] 3.1 MCP parity: `lessons_topics`, `lessons_deprecate`, `lessons_merge`.
- [ ] 3.2 Re-topic the mis-filed `agent-orchestration-resolve-named-skill-paths-from` (→ frontmatter) added by the external review; review the fork-context one.
- [ ] 3.3 (optional) typed edges between lessons.
- [ ] Docs (README + website) + full suite + validate at each phase boundary.
