---
name: add-global-mode-target
description: Use when adding global mode support for one existing agentsmesh target from a target-structure/global-path doc. Covers contract extraction from docs, descriptor.global layout wiring, generator/import/reference-rewrite touchpoints, strict tests, docs updates, and final verification for one target at a time.
---

# Add Global Mode Target

Use this skill when the task is to add global mode support for one existing target after you have a target-specific document that describes the native global file paths and behavior.

Read `references/global-mode-target-checklist.md` before editing code. Treat it as the minimum implementation and QA checklist.

## When To Use

- The target already exists in `../../../src/targets/<target>/`
- You have a target doc with native global paths or global behavior
- The repository-wide global-mode foundation already exists (`init|install|generate|import|diff|lint|watch|check|merge|matrix --global`)
- The work is scoped to one target at a time

## Do Not Use This Skill For

- Adding a brand-new target from scratch
- Defining the shared global-mode architecture for the first time
- Guessing a target's global behavior without a concrete doc or official source

Use `add-agent-target` for new targets. Use this skill only for the per-target global-mode pass.

## Non-Negotiable Rules

### MUST

- Start from the target doc and verify it against the live target implementation.
- Treat current code as the source of truth for project-mode behavior; preserve it unless the target doc requires a change.
- Write failing tests first for every new global-mode behavior.
- Keep the change target-scoped. Do not scatter new target-specific branches through shared code if descriptor metadata can carry the behavior.
- Add or update `descriptor.global` and keep project/global layout semantics explicit.
- Verify link rewriting and import normalization for the target's global paths, not just generation paths.
- Test unsupported global features explicitly. If the target has no meaningful native global support, encode that and test the skip/warning behavior.
- Update docs if the supported-tools matrix, README, or global-mode docs change.
- Run the full verification stack before claiming completion.

### MUST NOT

- Do not infer global paths from project-mode paths.
- Do not hardcode the target's global paths in shared cleanup or reference code when descriptor metadata can own them.
- Do not stop at “files generate”; global import, reference rewriting, and stale cleanup must also be checked when applicable.
- Do not silently mark a target as globally supported if only a subset of features work natively.

## Workflow

1. Extract the contract from the doc.
   - Record the target's native global root.
   - Record which features are globally supported: rules, commands, agents, skills, MCP, hooks, ignore, permissions.
   - Record root-instruction behavior, fallback paths, legacy paths, and any GUI-only/unsupported areas.
   - Record whether import from global files is meaningful and lossless.

2. Cross-check the live target implementation.
   - Read `../../../src/targets/<target>/index.ts`, `constants.ts`, `generator.ts`, `importer.ts`, and `linter.ts`.
   - Identify the current project layout in `descriptor.project`.
   - Identify where global behavior can reuse the same structure and where it cannot.

3. Write failing tests first.
   - Add unit tests for target layout metadata (`descriptor.global`, supported/unsupported features).
   - Add generation tests for global paths and root artifacts.
   - Add import/reference-rewrite tests if the target can import from global files.
   - Add stale-cleanup coverage if managed outputs differ from project mode.
   - Add command/integration coverage that proves the existing `--global` CLI surface works for the new target where applicable.

4. Implement the target-global layout.
   - Prefer target metadata over shared branching.
   - Fill `descriptor.global` for supported targets.
   - Keep managed outputs, root instruction paths, and path resolvers explicit.
   - If only some features are global, encode that precisely and keep unsupported ones absent or skipped.

5. Wire shared behavior only where necessary.
   - Update shared scope-aware path or import code only if the target truly needs it.
   - Keep shared changes generic and descriptor-driven.
   - If the target doc reveals a shared architectural gap, fix the gap once rather than adding one-off target branches.
   - Do not re-architect CLI scope handling unless the target proves a real shared gap.

6. Update docs and matrix surfaces.
   - Update `README.md` and `../../../website/src/content/docs/reference/supported-tools.mdx` if support levels or notes change.
   - Update `../../../docs/plan-global-mode.md` if the target behavior clarifies the implementation contract.

7. Verify and QA.
   - Run targeted tests during iteration.
   - Run the full verification stack at the end.
   - Apply the local `post-feature-qa` skill before marking the work done.

## Required Touchpoints

- Target descriptor and layout metadata:
  `../../../src/targets/<target>/index.ts`
- Shared target lookup/path helpers:
  `../../../src/targets/catalog/builtin-targets.ts`
  `../../../src/core/reference/map-targets.ts`
  `../../../src/core/reference/map.ts`
- If the target imports or rewrites links in global scope:
  `../../../src/core/reference/rewriter.ts`
  `../../../src/core/reference/output-source-map.ts`
  `../../../src/core/reference/import-rewriter.ts`
  `../../../src/core/reference/import-map-builders.ts`
- If managed output ownership changes:
  `../../../src/core/generate/stale-cleanup.ts`
- If the target needs command-surface proof:
  `tests/unit/cli/commands/*.test.ts`
  `tests/integration/*global*.test.ts`

Read the checklist reference for the full test and review matrix.

## Required Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

Add narrower unit/integration/e2e commands while iterating, but do not skip the full stack.

## Completion Standard

The task is not done until all of the following are true:

- The target's global contract is derived from the provided doc and encoded in code, not left implicit.
- `descriptor.global` is either implemented correctly or omitted intentionally for unsupported targets.
- Global generation paths are tested.
- Global import and reference rewriting are tested when the target supports them.
- Managed outputs and stale cleanup are correct for the target's global footprint.
- Docs and support matrix entries are current.
- Full verification passes.