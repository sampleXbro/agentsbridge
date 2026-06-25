---
'agentsmesh': minor
---

Declare Factory Droid `commands` as **Native** (both scopes; was `none`). Factory Droid reads custom slash commands from `.factory/commands/*.md` (project) and `~/.factory/commands/*.md` (global) — Markdown with optional `description` / `allowed-tools` frontmatter, filename as the command slug (per docs.factory.ai). AgentsMesh now generates and imports these native command files instead of projecting commands into `.factory/skills/am-command-*/SKILL.md`; `supportsConversion.commands` is removed. Regenerating replaces the old projected command-skills with native `.factory/commands/` files.
