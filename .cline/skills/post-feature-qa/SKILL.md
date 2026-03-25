---
name: post-feature-qa
description: "Apply after EVERY feature implementation, story completion, or task finish. Act as a senior QA engineer: make sure all edge cases are covered and implementation fully aligns with the story/spec. Use whenever you complete a story, ship a feature, or before marking a task done or opening a PR. Do not skip this — run the QA checklist before claiming work is complete."
---

# Post-Feature QA — Senior QA Engineer Mode

When a feature, story, or task has been implemented, you MUST run this QA pass before marking it complete. Acting as a senior QA engineer, verify test coverage and story alignment. Never claim work is done without this review.

## When to Trigger

- You just finished implementing a story or task
- You completed a feature and are about to commit or open a PR
- The user says "feature is done", "story complete", or "ready for review"
- You are about to mark checklist items complete in `tasks/todo.md` or similar
- Before any "verification complete" or "acceptance criteria verified" claim

## Core Workflow

### 1. Load the Story/Spec

- Find the story or feature spec. Common locations:
  - `ruleforge-prd.md` (or similar PRD)
  - `tasks/todo.md`
  - `docs/`, `specs/`, or ticket/issue description
- Extract:
  - **Acceptance criteria** — what must be true for the work to be done
  - **Task list** — individual work items (e.g. 2.1.1, 2.1.2)
  - **Explicit test requirements** — e.g. "Write tests: valid, invalid, every field type"

### 2. Cross-Check Acceptance Criteria

For each acceptance criterion:

| Criterion      | Action                                          |
| -------------- | ----------------------------------------------- |
| Behavioral     | Verify a test exists that asserts the behavior  |
| Config/format  | Verify tests for valid + invalid inputs         |
| Error handling | Verify tests for error paths and error messages |
| Edge cases     | Empty, null, boundary values, invalid types     |

If any criterion has no corresponding test, add the test.

### 3. Edge Case Checklist

Load `.cline/skills/post-feature-qa/references/edge-case-checklist.md` for a full reference. For every public API, config schema, or behavior:

- **Valid inputs**: minimal valid, full valid, optional fields omitted
- **Invalid types**: wrong type (string vs number, array vs object, etc.)
- **Boundaries**: empty array/string, single element, max length if applicable
- **Null/undefined**: missing required fields, explicit null where relevant
- **Invalid values**: out-of-range, invalid enum, malformed structure
- **Combined failures**: multiple invalid fields in one input

Apply this systematically to each field or function you implemented.

### 4. Story Alignment

- Every task in the story has corresponding code or tests
- No scope creep — nothing implemented that wasn't in the spec
- Exported types/APIs match what the spec describes
- Defaults, error messages, and formats match the spec

### 5. Run Verification

- Run the test suite: `pnpm test` (or equivalent)
- **Integration tests**: Run `pnpm build && pnpm test` — integration tests in `tests/integration/` require the built dist
- Run lint: `pnpm lint`
- Optionally: `pnpm test --coverage` and check coverage for new code
- Fix any failures before claiming complete

### 6. Integration Test Checklist

When completing a story, ensure integration tests exist and pass:

- Story 1–2: `tests/integration/story-1-cli.test.ts`, `story-2-config.test.ts`
- For new stories: Add `story-N-<name>.test.ts` covering acceptance criteria end-to-end
- Integration tests run the full CLI (spawn) or full config/generation pipeline with fixtures

## Output Format

Produce a **QA Report** with:

```markdown
## QA Report — [Story/Task ID]

### Acceptance Criteria

| Criterion | Covered by test? | Status   |
| --------- | ---------------- | -------- |
| ...       | ✓ / ✗            | OK / GAP |

### Edge Cases

| Scenario | Covered? | Test location |
| -------- | -------- | ------------- |
| ...      | ✓ / ✗    | path:line     |

### Gaps Identified

- [ ] Missing test for X
- [ ] No test for invalid Y

### Actions Taken

- Added tests for ...
- Fixed ...
```

If gaps exist, fix them and re-run the report until all gaps are closed.

## Principles

- **Evidence over assertions**: Do not say "tests cover edge cases" without showing which tests cover which cases.
- **Explicit over implicit**: List each edge case and the test that covers it.
- **Fix, don't report**: When you find a gap, add the test. Don't just note it and move on.
- **Story as source of truth**: If the spec says "every field type", ensure every field has invalid-type tests.