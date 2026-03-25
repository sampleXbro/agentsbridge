---
name: add-agent-target
description: Use when adding support for a new AI agent target to agentsbridge. Covers official format research, canonical mapping, importer/generator/linter work, realistic fixtures, unit/integration/e2e coverage, matrix/docs updates, and final verification.
---

# Add Agent Target

Use this skill when the task is to add a new supported agent target to this repository.

Read `.agents/skills/add-agent-target/references/target-addition-checklist.md` before editing code. Treat it as the minimum touchpoint list, not an exhaustive substitute for reading the implementation.

## Non-Negotiable Requirements

### MUST

- Search the internet for the target's current official file structure, config files, and example content before changing code.
- Prefer official docs and other primary sources. Use vendor examples or source code only when official docs are incomplete, and call that out explicitly.
- Separate the target product from the current assistant runtime before making format decisions. Do not confuse a generated target like `codex-cli` with Codex desktop/chat, or local CLI MCP config with app-managed connectors.
- Capture the target's real capability map: rules, commands, agents, skills, MCP, hooks, ignore, permissions, and any target-specific equivalents.
- Write tests first for every new behavior. Do not implement first and backfill later.
- Add unit, integration, and e2e coverage for the complete import and generate flow.
- Add rich and realistic fixtures for the new target. Fixtures must resemble real projects, not toy placeholders.
- Cover all edge cases for the new target, including legacy paths, fallbacks, malformed files, partial support, and unsupported features.
- Update every affected command surface and user-facing document so the new target is discoverable and accurately described.
- Update compatibility matrix behavior and docs to reflect native, embedded, partial, or unsupported features.
- Update init detection and import empty-state messaging for the new target when native files exist.
- Reuse existing capability-focused tests where possible; extend them instead of duplicating assertions across multiple files.
- Preserve the canonical `.agentsbridge/` contract. If the target cannot represent a feature natively, model that explicitly instead of inventing fake native output.
- Ensure every internal file link/reference inside generated or imported `.md` artifacts is convertible through the shared reference-rewrite pipeline, just like the existing targets. Do not ship a new target unless canonical `.agentsbridge/...` references round-trip cleanly across that target’s Markdown surfaces.
- Run the full verification stack before claiming completion.
- Run the local `post-feature-qa` skill before marking the task done.

### MUST NOT

- Do not infer the target format from old fixtures, README text, or memory alone.
- Do not add placeholder fixtures with `SYNTHETIC` markers or obviously fake content.
- Do not add shallow smoke tests as a substitute for feature coverage.
- Do not silently skip unsupported features; document and test the chosen behavior.
- Do not leave commands, schema enums, init detection, matrix output, or docs partially updated.

## Workflow

1. Research the target on the internet.
   - Find the current official docs.
   - Confirm the exact on-disk file paths, frontmatter keys, JSON/TOML shape, and any legacy/fallback paths still in use.
   - Confirm the exact runtime surface you are targeting. For MCP, verify whether the target reads project files, user-home config, app settings, or remote connectors, and do not project one surface's setup rules onto another.
   - For Codex specifically: treat `codex-cli` project files like `.codex/config.toml` separately from Codex desktop/chat sessions, which use app/session-managed tools and connectors instead of repo config.
   - Record the source links in the docs you update.

2. Map native capabilities to the canonical model.
   - Decide which canonical features are `native`, `embedded`, `partial`, or `none`.
   - Identify target-specific translations and lossy cases.
   - Identify precedence rules when the target has multiple file formats or legacy paths.

3. Write failing tests first.
   - Add unit tests for the target generator and importer.
   - Add integration coverage where CLI wiring or end-to-end command behavior changes.
   - Extend e2e capability suites for native import/generate behavior.
   - Add or extend full-sync coverage if the target supports import.

4. Add realistic fixtures before implementation is complete.
   - Create a target fixture directory under `tests/e2e/fixtures/`.
   - Include realistic root instructions, scoped rules, commands/workflows, skills, agents, settings, ignore files, and supporting files where the target supports them.
   - Use content that looks like a real repo and preserves the branches the importer must parse.

5. Implement target support.
   - Add `src/targets/<target>/constants.ts`, `generator.ts`, `importer.ts`, and `linter.ts` as needed.
   - Wire the target into config validation, CLI import/init flows, matrix support, and any feature filtering.
   - Add or extend reference-map/import-normalization handling for every Markdown artifact path the target emits or imports, including shared root files and embedded command/agent projections.
   - Keep the implementation simple and explicit. Prefer pure translation functions over target-specific special cases scattered through the codebase.

6. Update docs and command surfaces.
   - Update `README.md`, `docs/agents-folder-structure-research.md`, and any other source-of-truth docs affected by the new target.
   - Update supported target lists, help text, import examples, compatibility tables, and architecture docs.
   - If the target has notable limitations, document them precisely.

7. Verify and QA.
   - Run targeted tests while iterating.
   - Run the full verification stack before completion.
   - Apply the local `post-feature-qa` skill and close any gaps it finds.

## Required Verification

- `pnpm test`
- `pnpm test:e2e`
- `pnpm lint`
- `pnpm typecheck`

If a narrower command is useful during iteration, run it first, but do not skip the full stack at the end.

## Completion Standard

The task is not done until all of the following are true:

- The target can be selected in config and CLI flows.
- Import and generate behavior are both covered for every supported feature.
- Unsupported or lossy features are documented and tested.
- Fixtures are rich enough to exercise real parsing branches.
- Docs and compatibility tables are current.
- Full verification passes.