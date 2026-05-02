---
'agentsmesh': minor
---

Add `kilo-code` as a new built-in target. Kilo Code is a multi-surface AI coding platform (VS Code extension, JetBrains plugin, CLI, cloud agent) and a fork of Roo Code (which is a fork of Cline).

Generation always uses Kilo's new layout: `AGENTS.md` (root), `.kilo/rules/`, `.kilo/commands/`, `.kilo/agents/` (first-class subagents), `.kilo/skills/`, `.kilo/mcp.json`, and `.kilocodeignore`. Import covers BOTH the new layout and Kilo's legacy layout (`.kilocode/`, `.kilocodemodes`) so existing kilo / Roo-era projects round-trip cleanly.

Capabilities (project + global):

- `rules`, `additionalRules`, `commands`, `agents`, `skills`, `mcp`, `ignore`: native
- `hooks`: none — Kilo Code has no user-facing lifecycle hook system; canonical hooks emit a lint warning.
- `permissions`: none — Kilo permissions live in `kilo.jsonc`, which agentsmesh does not generate in v1; canonical permissions emit a lint warning.

Global mode generates under `~/.kilo/` (`AGENTS.md`, `rules/`, `commands/`, `agents/`, `skills/`, `mcp.json`) plus `~/.kilocodeignore`, and mirrors skills into `~/.agents/skills/` for cross-tool compatibility (suppressed when `codex-cli` is also active).

Use `agentsmesh import --from kilo-code` to migrate existing Kilo projects (new or legacy layout) into canonical `.agentsmesh/`, then `agentsmesh generate --targets kilo-code` to project them back as the documented new layout.
