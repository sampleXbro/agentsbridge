---
"agentsmesh": minor
---

feat(amp): add Amp (Sourcegraph) as a new built-in target

Amp is a coding agent by Sourcegraph (ampcode.com). This adds full project and global mode support:

- **Rules**: `AGENTS.md` (root + embedded additional rules)
- **Skills**: `.agents/skills/*/SKILL.md` skill bundles (shared path with Codex CLI, consumer role)
- **MCP**: `.amp/settings.json` under `amp.mcpServers` key with settings merge
- **Global mode**: `~/.config/amp/AGENTS.md`, `~/.config/amp/skills/`, `~/.config/amp/settings.json`
- Commands and agents projected as skills via `supportsConversion`
- Lint warnings for unsupported features (hooks, ignore, permissions)
