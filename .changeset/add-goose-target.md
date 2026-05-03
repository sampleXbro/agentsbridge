---
"agentsmesh": minor
---

feat(goose): add Goose (Block) as a new built-in target

Goose is an open-source AI coding agent by Block (goose-docs.ai). This adds full project and global mode support:

- **Rules**: `.goosehints` (root + embedded additional rules)
- **Skills**: `.agents/skills/*/SKILL.md` skill bundles (shared path with Codex CLI)
- **Ignore**: `.gooseignore` with gitignore-style patterns
- **Global mode**: `~/.config/goose/.goosehints`, `~/.config/goose/.gooseignore`, `~/.agents/skills/`
- Lint warnings for unsupported features (commands, hooks, MCP, permissions)
