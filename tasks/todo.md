# Capability correction campaign — VERIFIED QUEUE (current)

Source: per-target adversarial verification (`wf_745aa03f-dad`) of the external
audit (`target-capability-audit-2026-06-24.md`) against live code + primary docs.
85 actionable findings, 8 rejected, 13 need-human, 26/30 targets verified.
NOTE: this supersedes the unverified "23 gaps" plan below — verification REJECTED
several of its claims (e.g. Trae commands/agents file-surface; Continue hooks).

## Shipped ✅ (uncommitted, one-commit-at-end)
- [x] codex-cli hooks `partial → native` (both scopes) — changeset, full QA.
- [x] amazon-q agents `systemPrompt → prompt` key fix (gen + import + fallback) — changeset, full QA.
- [x] cursor hooks format fix — camelCase events + flat array (was PascalCase nested, never fired); round-trip + dropped-event lint warning; changeset, full QA (13-file blast radius).
- [x] amazon-q additionalRules project `none → native` (already emits/imports `.amazonq/rules/<slug>.md`); global stays none (no global rules dir on disk); changeset.
- [x] augment-code rule frontmatter `type` key (was boolean `always_apply`/`agent_requested`); import accepts both; changeset, full QA.

## Corrections from primary-source verification (findings the audit got wrong)
- warp mcp/project: NOT a wrong-path bug — Warp reads `.mcp.json` at repo root too (shared provider path). Leave project as-is. Only warp **global** MCP (`~/.warp/.mcp.json`) is a genuine under-declaration, but it needs global-mode generation wiring (gating + path rebase) — deferred to a focused slice.

## Tier 1 — broken/wrong native (fix-in-place, expansion-safe). HIGHEST PRIORITY.
- [ ] antigravity rules/global path → `~/.gemini/GEMINI.md`
- [ ] antigravity mcp/global path → `~/.gemini/config/mcp_config.json`
- [ ] antigravity hooks shape (named-hook nesting) + ADD importer
- [ ] antigravity skills/global path → `~/.gemini/config/skills/`
- [x] cursor hooks: PascalCase→camelCase events + FLAT array shape — silent no-fire (DONE)
- [ ] cline hooks: filename-IS-event format (`.clinerules/hooks/<EventName>`)
- [ ] warp mcp path → `.warp/.mcp.json` / `~/.warp/.mcp.json`
- [x] augment-code rules frontmatter key `type` (DONE)
- [ ] aider rules: wire `CONVENTIONS.md` via `.aider.conf.yml` `read:`
- [x] copilot hooks/project `partial → native` (`.github/hooks/*.json`) — DONE (round-trip already shipped). Follow-up: copilot GLOBAL hooks native via `~/.copilot/hooks/*.json` (needs global-mode wiring; lesson-confirmed).
- [ ] factory-droid hooks + agents: ADD importer (generate-only today)
- [ ] opencode mcp+permissions settings-merge base; additionalRules via `instructions` key
- [ ] roo-code rules/global path `~/.roo/rules/`
- [ ] kilo-code global paths `~/.config/kilo/*`; mcp key; permissions import
- [ ] amp permissions shape (`amp.permissions`) + import
- [ ] crush permissions shape (`permissions.allowed_tools`)
- [ ] claude-code hooks/permissions settings.json location (verify current emit)
- [ ] codex-cli mcp streamable-HTTP + config.toml merge (P1)
- [ ] deepagents rules/skills global per-agent paths
- [ ] gemini-cli permissions via `.gemini/policies/*.toml`
- [ ] continue rules/global → embedded in `config.yaml`

## Tier 2 — under-declared (none/partial → native, expansion). HIGH PRIORITY.
- [ ] amazon-q additionalRules/project `none → native`
- [ ] cursor additionalRules `embedded → native`
- [ ] pi-agent commands `none → native`
- [ ] factory-droid commands `none → native`; permissions → embedded
- [ ] goose hooks `none → native`
- [ ] kiro permissions/global `none → native`
- [ ] kilo permissions; warp mcp/global + ignore/project + additionalRules
- [ ] augment hooks/global + permissions; continue permissions/global + commands/global
- [ ] copilot hooks/global + mcp/global; crush mcp/hooks/commands global
- [ ] gemini permissions/global; roo agents/project; deepagents agents; junie hooks/permissions
- [ ] jules mcp `none → partial`
- [ ] trae hooks (LOW confidence — confirm primary source first)

## Downgrades / removals (native→none/partial) — BREAKING, needs decision.
- [ ] claude-code ignore `→ none`; amp hooks `→ none`; cline agents `→ none`
- [ ] aider skills `→ none`; copilot commands/global `→ none`; roo ignore/global `→ none`
- [ ] cline mcp/project `→ partial`; roo mcp+agents/global `→ partial`
- [ ] replit mcp `→ partial`; codex additionalRules/project `→ partial`

## Needs-human (judgement calls)
kiro permissions/project, claude-code frontmatter globs→paths, copilot ignore/permissions,
kilo global read semantics, warp/replit global rules (UI partial?), goose permissions/global,
cline mcp/global path, gemini hooks (partial-emits-file?), junie permissions/project.

## Not yet verified (session limit) — follow-up verification pass needed
qwen-code, rovodev, windsurf, zed

---

# (SUPERSEDED, UNVERIFIED) Prior-session plans below — kept for history

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
