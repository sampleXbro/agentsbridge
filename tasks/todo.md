# Move agentsmesh managed blocks to the TOP of the main instruction file

**Goal:** The Generation Contract block and the Lessons ritual block should appear at the
*beginning* of a target's primary root instruction file, not appended at the end.

## Design

- Add a frontmatter-preserving body-top inserter `insertAtBodyTop(content, block)` in
  `managed-blocks.ts`. It splits any leading `---…---` frontmatter verbatim and places the
  block at the top of the body (frontmatter stays first).
- **Generation Contract** (`appendAgentsmeshRootInstructionParagraph`): strip any existing
  block + legacy forms, then `insertAtBodyTop`. Existing files relocate end→top on regenerate.
- **Lessons block** (`appendLessonsParagraph`): strip existing block + legacy raw forms, then
  `insertAtBodyTop` (frontmatter-aware — `_root.md` keeps its frontmatter first).
- Seed in `lessons/init.ts`: place the block before `# Operational Guidelines`.
- Canonical `.agentsmesh/rules/_root.md`: move the lessons block to the top of the body.

Order in the generated primary file becomes: Generation Contract → Lessons → user content
(contract is prepended by the decorator on top of the rendered body that now leads with lessons).

## Tasks (TDD — failing tests first) — ALL COMPLETE ✅

- [x] 1. Updated unit tests (managed-blocks-branches, root-instruction-paragraph, lessons-paragraph).
- [x] 2. Implemented `insertAtBodyTop` + raw-frontmatter split in `managed-blocks.ts`.
- [x] 3. Rewrote `appendAgentsmeshRootInstructionParagraph` to strip + insert-at-top.
- [x] 4. Rewrote `appendLessonsParagraph` to strip + insert-at-top (frontmatter-aware).
- [x] 5. Updated seed in `src/lessons/init.ts` (block before heading).
- [x] 6. Added e2e position assertions (contract → lessons → body) in `init-lessons.e2e.test.ts`.
- [x] 7. Moved the lessons block to the top of canonical `.agentsmesh/rules/_root.md`.
- [x] 8. Rebuilt local CLI, regenerated 20 target files, verified blocks at top + idempotent.
- [x] 9. Updated docs: `docs/add-new-target-playbook.md` wording.
- [x] 10. Full suite 8640 passed; typecheck + lint clean; lessons files ≤200 lines. post-feature-qa done.
