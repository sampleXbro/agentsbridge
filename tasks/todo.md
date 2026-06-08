# Two-tier lessons delivery (borrowing the superpowers structure)

## Goal
Split the lessons contract into two tiers, using agentsmesh's NATIVE primitives
(not a SessionStart hook — that event isn't canonical and hooks are `none` on
21/32 targets, whereas rules+skills are native everywhere):

- **Tier 1 (always-on):** trimmed `LESSONS_PROCEDURAL_RULE`, still injected into
  canonical `.agentsmesh/rules/_root.md` as a managed block → reaches every target.
  Keeps the *binding* essentials (both commands, BLOCKING framing, recall-scope
  incl. read-only, capture-scope incl. user pushback, graph path, MCP fallback,
  pointer to the skill). Drops the *expansive how-to* (full command set, topic
  workflow, trigger-flag mechanics, exhaustive excuse enumeration).
- **Tier 2 (on-demand manual):** new canonical `.agentsmesh/skills/lessons/SKILL.md`
  carrying the full manual. Generates to every skill-supporting target; can grow
  without bloating always-on context.
- **Tier 3 (degradation):** targets without skills still get the trimmed Tier-1
  trigger. Free fallback.

## Design decisions
- Skill is **create-if-missing** (like `lessons.json`) — canonical, user-owned content,
  not a managed-block artifact. Seeded by `scaffoldLessons` so init AND the import safety
  net both produce a cohesive subsystem (graph + root block + skill).
- Current long `LESSONS_PROCEDURAL_RULE` text captured as `LESSONS_RULE_V2` and added
  to `LEGACY_RAW_FORMS` (newest-first) so existing projects strip/upgrade exactly once.

## Steps (TDD — tests first) — ALL COMPLETE ✅
1. [x] `src/lessons/skill.ts`: `LESSONS_SKILL_{NAME,DESCRIPTION,BODY}` + `LESSONS_SKILL_FILE`.
2. [x] Trim `LESSONS_PROCEDURAL_RULE` in `src/lessons/paths.ts` (+ skill pointer).
3. [x] `lessons-paragraph.ts`: add `LESSONS_RULE_V2` to `LEGACY_RAW_FORMS`.
4. [x] `src/lessons/init.ts`: seed skill create-if-missing; result created/skipped (graph, skill).
5. [x] Tests: skill.test (new), paths.test (new Tier-1 contract), lessons-paragraph.test (V2),
   init.test (creates skill + preserves user-authored skill + idempotent order),
   init-lessons.integration (created set incl. skill), e2e matrix (skill in expectedImported).
   Contract matrix needed no change (bypasses CLI safety net; only checks root block).
6. [x] Renderer already iterates `lessons.created` — skill prints with no change.
7. [x] Full suite green: 8653 passed, 1 skipped; typecheck + lint clean.
8. [x] Dogfooded: retrofit → generate (23 created, 20 updated) → `check` = lock in sync.
9. [x] Docs: README + `cli/init.mdx` + `cli/lessons.mdx`.
10. [x] post-feature-qa: added the don't-clobber-user-skill edge-case test. Captured the
    stale-dist e2e lesson (`dist-backed-tests-when-a-change-alters-cli`).
