---
"agentsmesh": minor
---

feat(warp): add Warp as a new built-in target

Warp is an agentic development environment by Warp.dev. This adds project and global mode support:

- **Rules**: `AGENTS.md` (root + embedded additional rules); legacy `WARP.md` supported on import
- **Skills**: `.warp/skills/` with YAML frontmatter skill bundles
- **MCP**: `.mcp.json` at project root (standard format, shared with Claude Code)
- **Commands/Agents**: projected as skills via `supportsConversion`
- **Global mode**: `~/.warp/skills/` (skills only — global rules are UI-managed via Warp Drive)
- Lint warnings for unsupported features (hooks, ignore, permissions)
