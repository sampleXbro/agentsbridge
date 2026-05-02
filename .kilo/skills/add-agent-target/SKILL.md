---
name: add-agent-target
description: Use when adding support for a new AI agent target to agentsmesh. Covers official format research, canonical mapping, importer/generator/linter work, realistic fixtures, unit/integration/e2e coverage, matrix/docs updates, and final verification. Includes both project and global mode from day one.
---

# Add Agent Target

Use this skill when the task is to add a brand-new supported agent target to this repository (built-in) or as an external plugin package.

**Primary reference**: `docs/add-new-target-playbook.md` is the step-by-step workflow (phases 1–9, file templates, verification gates). Open it first and follow it. This skill file is the contract — the non-negotiable rules, touchpoints, and completion bar. The playbook is how; this file is what and why.

**Companion skill**: `add-global-mode-target` — use only when extending global-mode support into an existing target that was built before global was a first-class contract. For new targets, global mode is part of this skill (scaffold wires it automatically).

## When To Use

- The task is to add a tool not currently in `src/targets/catalog/target-ids.ts`
- Scope covers both `project` and `global` modes unless the target has no meaningful global surface
- Delivery is either built-in (in this repo) or external plugin (standalone npm package)

## Do Not Use This Skill For

- Extending global-mode coverage on an existing target — use `add-global-mode-target`
- Changing capability levels for an existing target — update the target's descriptor directly
- Plugin feature work that doesn't add a new target id

## Non-Negotiable Rules

### MUST

- Search the internet for the target's current official file structure, config files, and example content before changing code.
- Prefer official docs and other primary sources. Use vendor examples or source code only when official docs are incomplete, and call that out explicitly.
- Separate the target product from the current assistant runtime before making format decisions. Do not confuse a generated target like `codex-cli` with Codex desktop/chat, or local CLI MCP config with app-managed connectors.
- Capture the target's real capability map for every canonical feature: rules, additionalRules, commands, agents, skills, mcp, hooks, ignore, permissions.
- Start from `agentsmesh target scaffold <id>` when building a built-in target. Do not hand-write the 10 skeleton files the scaffold produces.
- Write failing tests first for every new behavior. Do not implement first and backfill later.
- Add unit, integration, and e2e coverage for the complete import and generate flow, including global scope when applicable.
- Add rich and realistic fixtures for the new target. Fixtures must resemble real projects, not toy placeholders.
- Cover all edge cases for the new target, including legacy paths, fallbacks, malformed files, partial support, and unsupported features.
- Wire descriptor capabilities for both project and global scope. New targets must include global mode unless the target has no global config surface at all, and that absence must be documented.
- Update every affected command surface and user-facing document so the new target is discoverable and accurately described.
- Update the compatibility matrix to reflect native, embedded, partial, or unsupported features. The matrix auto-builds from descriptor capabilities; `pnpm matrix:verify` must pass.
- Update init detection and import empty-state messaging for the new target when native files exist.
- Reuse existing capability-focused tests where possible; extend them instead of duplicating assertions across multiple files.
- Preserve the canonical `.agentsmesh/` contract. If the target cannot represent a feature natively, model that explicitly instead of inventing fake native output.
- Ensure every internal file link or reference inside generated or imported Markdown artifacts is convertible through the shared reference-rewrite pipeline, just like the existing targets. Do not ship a new target unless canonical `.agentsmesh/` references round-trip cleanly across that target's Markdown surfaces.
- Run the full verification stack, including the packaging gates (`pnpm attw`, `pnpm publint`, `pnpm consumer-smoke`), before claiming completion.
- Run the `post-feature-qa` skill before marking the task done.

### MUST NOT

- Do not infer the target format from old fixtures, README text, or memory alone.
- Do not add placeholder fixtures with `SYNTHETIC` markers or obviously fake content.
- Do not add shallow smoke tests as a substitute for feature coverage.
- Do not silently skip unsupported features; document and test the chosen behavior.
- Do not leave commands, schema enums, init detection, matrix output, or docs partially updated.
- Do not hardcode target-specific branches in shared code when a descriptor field can carry the behavior.

## Workflow (detailed in `docs/add-new-target-playbook.md`)

1. **Research** — §1 of the playbook. Answer every research-checklist item from primary sources before writing code.
2. **Scaffold** — §2 of the playbook. Run `pnpm exec agentsmesh target scaffold <id>`, then register the id in the three catalog files listed there.
3. **Constants and capabilities** — §3. Fill in paths and capability levels for both project and global scope.
4. **Tests first** — §4. Add realistic fixtures under `tests/e2e/fixtures/<id>-project/` and write failing unit/integration/e2e tests.
5. **Implement generators, importers, and reference maps** — §5. Feature-by-feature, using existing targets as reference implementations.
6. **Global mode** — §6. Fill in `descriptor.global`, `rewriteGeneratedPath`, and any `skillMirror` or `sharedArtifacts` needs.
7. **Plugin packaging** — §7. Only if shipping as an external plugin rather than a built-in.
8. **Matrix and docs** — §8. Run `pnpm schemas:generate && pnpm matrix:generate` and update `website/src/content/docs/reference/supported-tools.mdx`.
9. **Verification** — §9. Run the full stack (see below). All must pass.

Refer to `./references/target-addition-checklist.md` for the concrete audit list of touchpoints, tests, fixtures, and edge cases.

## Required Verification

Before claiming completion, every command must pass:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm matrix:verify`
- `pnpm publint`
- `pnpm attw`
- `pnpm consumer-smoke`

If a narrower command is useful during iteration, run it first, but do not skip the full stack at the end.

## Completion Standard

The task is not done until all of the following are true:

- The target appears in `agentsmesh matrix` CLI output and passes `pnpm matrix:verify`.
- Import and generate behavior are both covered for every supported feature, in both project and global scope where applicable.
- Unsupported or lossy features are documented in `website/src/content/docs/reference/supported-tools.mdx` and tested.
- Fixtures under `tests/e2e/fixtures/<id>-project/` are rich enough to exercise real parsing branches (rules, skills, MCP, hooks, ignore as applicable).
- Round-trip import → generate preserves content byte-for-byte where the format permits.
- README matrix and website supported-tools page are in sync.
- All verification commands listed above pass.
- `post-feature-qa` skill has been applied and any gaps closed.