---
"agentsmesh": minor
---

feat(opencode): add OpenCode as a new built-in target

OpenCode (opencode.ai) is an open-source AI coding agent CLI/TUI. This adds full project and global mode support:

- **Rules**: `AGENTS.md` (root) + `.opencode/rules/*.md` (additional)
- **Commands**: `.opencode/commands/*.md` with description frontmatter
- **Agents**: `.opencode/agents/*.md` with mode/description/model frontmatter
- **Skills**: `.opencode/skills/*/SKILL.md` skill bundles
- **MCP**: `opencode.json` with native format conversion (array `command`, `environment` key)
- **Global mode**: `~/.config/opencode/` with full feature parity
- Lint warnings for unsupported features (hooks, ignore, permissions)
