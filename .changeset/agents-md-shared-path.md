---
'agentsmesh': minor
---

Replace the AGENTS.md content-normalization logic with a shared-path rewrite skip. When two or more active targets emit the same root-instruction path (most commonly `AGENTS.md`), every copy keeps canonical `.agentsmesh/...` references instead of being rewritten to target-specific paths. The collision resolver then merges the byte-identical copies trivially.

**User-visible behavior change**

The single `AGENTS.md` at the project root now contains references like `.agentsmesh/skills/<name>/SKILL.md` rather than the previous `.agents/skills/<name>/SKILL.md` (or any other target-specific prefix). Tools reading `AGENTS.md` follow the path literally and find the file under `.agentsmesh/`, which is always present as the canonical source of truth. Each target's own directory (`.agents/skills/`, `.factory/skills/`, etc.) is still generated and its files still receive normal per-target reference rewriting — only the shared root-instruction file uses canonical paths.

**Why**

The previous approach generated N copies of `AGENTS.md`, rewrote their references to N different target-specific paths, and then ran ~200 lines of fragile reverse-normalization to prove they were "actually the same". That logic carried hardcoded target IDs, regex bare-path anchoring, and reverse reference maps — every new target risked breaking it. The new approach is structural: skip rewriting when a path is claimed by 2+ targets as their root instruction (detected via descriptor `rootInstructionPath` + `outputFamilies` of kind `'additional'`), so the content stays byte-identical and collision merge is a no-op. Plugin targets that declare a `rootInstructionPath` get the same treatment automatically — no per-target opt-in needed.

**Internal**

- Drops `src/targets/catalog/agents-md-overlap.ts` (199 lines) and its test file
- Adds `computeSharedRootInstructionPaths()` to `engine.ts` (descriptor-driven, no hardcoded target IDs)
- Adds an optional `skipPaths: ReadonlySet<string>` parameter to `rewriteGeneratedReferences()`
- Drops gemini-cli's legacy pre-emptive `.agentsmesh/skills/` → `.agents/skills/` substitution in `generateRules` — no longer needed under the new approach
- 28 new tests across `tests/unit/core/shared-root-instruction-paths.test.ts`, `reference-rewriter-shared-paths.test.ts`, and `tests/contract/shared-agents-md.test.ts`
