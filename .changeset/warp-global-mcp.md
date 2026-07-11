---
"agentsmesh": minor
---

Warp: support global MCP config natively. `agentsmesh generate --global` now writes MCP servers to `~/.warp/.mcp.json` (standard `mcpServers` JSON), and `agentsmesh import --global` reads it back to canonical. Raises `warp` global `mcp` capability from none to native (project scope was already native).
