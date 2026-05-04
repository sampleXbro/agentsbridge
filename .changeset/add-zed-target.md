---
"agentsmesh": minor
---

feat(zed): add Zed as a new built-in target

Zed is a modern code editor with a built-in AI assistant (zed.dev). This adds project and global mode support:

- **Rules**: `.rules` (root + embedded additional rules in a single file)
- **MCP**: `.zed/settings.json` under `context_servers` key with settings merge
- **Global mode**: `~/.config/zed/settings.json` (MCP only — no global rules file)
- Lint warnings for unsupported features (hooks, ignore, permissions)
