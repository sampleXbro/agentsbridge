# Top-Tier Target Capability Audit (COMPLETE)

- [x] Read architecture, source-driven development, and post-feature QA guidance.
- [x] Identify the working top-tier target set and current capability maps.
- [x] Verify every working-scope target against current official documentation/source.
- [x] Write failing tests for each confirmed support mismatch.
- [x] Implement confirmed target support changes.
- [x] Regenerate README and website support matrices; update target detail docs.
- [x] Run focused tests, full verification stack, and post-feature QA.

Covered: Claude Code, Codex CLI, Cursor, GitHub Copilot, Gemini CLI, Cline,
Windsurf, Kiro, Continue, OpenCode.

---

# Full Target Capability Audit — Gap Filling (23 gaps across 30 targets)

Full plan: `tasks/plan.md`

## Phase 1: MCP gaps (Goose global + Copilot project)

- [ ] Task 1: Goose MCP — `generateMcp()`, global caps `native`, YAML `extensions` in `~/.config/goose/config.yaml`
- [ ] Task 2: Copilot MCP — `generateMcp()`, project caps `native`, JSON `servers` in `.vscode/mcp.json`

**Checkpoint 1**: `pnpm test && pnpm build` green

## Phase 2: Agent gaps (Augment Code, Amazon Q, Zed skills)

- [ ] Task 3: Augment Code agents — `generateAgents()`, `.augment/agents/*.md` (YAML frontmatter), both scopes `native`
- [ ] Task 4: Amazon Q — `generateAgents()`, `.amazonq/cli-agents/*.json` with inline hooks + permissions; agents `native`, hooks `partial`, permissions `native`
- [ ] Task 5: Zed skills — `generateSkills()`, `.agents/skills/` shared path, Zed as `consumer`, `skills: 'native'`

**Checkpoint 2**: `pnpm test && pnpm build` green

## Phase 3: Permissions & Commands (Junie, Kilo Code, Trae, Warp, Roo Code)

- [ ] Task 6: Junie permissions — `generatePermissions()`, `~/.junie/allowlist.json`, global caps `native`
- [ ] Task 7: Kilo Code permissions — `generatePermissions()`, `permission` key in `kilo.jsonc`, both scopes `native`
- [ ] Task 8: Trae commands — `generateCommands()`, `.trae/commands/*.md`, both scopes `native`; investigate Trae agents
- [ ] Task 9: Warp + Roo Code — declaration-only `permissions: 'partial'` + lint warnings; Windsurf agents confirmed unchanged

**Checkpoint 3**: `pnpm test && pnpm build` green

## Phase 4: Hooks batch (Factory Droid, Deep Agents CLI, Rovo Dev, Antigravity, Qwen Code)

- [ ] Task 10: Factory Droid hooks — `generateHooks()`, `.factory/hooks.json`, 9 events, both scopes `native`
- [ ] Task 11: Deep Agents CLI hooks — `generateHooks()`, `.deepagents/hooks.json`, both scopes `native`
- [ ] Task 12: Rovo Dev hooks + permissions — `emitScopedSettings()`, `~/.rovodev/config.yml`, global `native` for both; project `none`
- [ ] Task 13: Antigravity hooks — `generateHooks()`, `.agents/hooks.json` / `~/.gemini/config/hooks.json`, both scopes `native`
- [ ] Task 14: Qwen Code hooks + permissions — extend `settings.json` emitter; both scopes `native`

**Checkpoint 4**: `pnpm test && pnpm build` green

## Phase 5: Amp (3 gaps) + Antigravity permissions

- [ ] Task 15: Amp commands + hooks + permissions — `generateCommands()`, extend settings.json emitter; check `.agents/commands/` ownership
- [ ] Task 16: Antigravity permissions — declaration `partial`, lint guidance pointing to hooks system

**Checkpoint 5**: `pnpm test && pnpm build` green; all 23 gaps addressed

## Phase 6: Docs & QA

- [ ] Task 17: Regenerate README + website `supported-tools.mdx` matrices for all 23 changes
- [ ] Task 18: Post-feature QA (edge cases, empty inputs, E2E smoke per target)

---

# Lessons Prompt Tightening

- [x] Inspect current lessons source and tests.
- [x] Write failing tests for the lesson gate wording.
- [x] Update the canonical root lesson prompt and managed lessons skill.
- [x] Run targeted verification and post-feature QA.
