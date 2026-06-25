---
'agentsmesh': minor
---

Declare Pi Agent `commands` as **Native** (both scopes; was `none`). Pi discovers prompt templates from `.pi/prompts/*.md` (project) and `~/.pi/agent/prompts/*.md` (global) — Markdown with optional `description` frontmatter, filename as the command name, `$ARGUMENTS` substitution (per earendil-works/pi). AgentsMesh now generates and imports these native prompt templates instead of projecting commands into `.pi/skills/am-command-*/SKILL.md`; `supportsConversion.commands` is removed (agents are still projected as skills). Also corrects `metadata.officialUrl` to `https://github.com/earendil-works/pi` (was the non-existent `pi-labs/pi-agent`). Canonical `allowedTools` have no Pi equivalent and are dropped on generate.
