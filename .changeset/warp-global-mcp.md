---
"agentsmesh": minor
---

Warp: correct project MCP path to `.warp/.mcp.json` (Warp's own native surface) and raise five additional capabilities.

**Path correction (project MCP):** `agentsmesh generate` now writes MCP servers to `.warp/.mcp.json` at the project root — Warp's own native project-scope config — instead of `.mcp.json`. The root `.mcp.json` is a cross-tool compatibility path Warp reads via autodiscovery (not its own primary surface). `agentsmesh import --from warp` reads `.warp/.mcp.json` accordingly.

**Capability raises (both scopes unless noted):**

- `commands`: none → embedded — commands are projected as Warp skill bundles under `.warp/skills/`.
- `hooks`: none → partial — Warp has no file-based lifecycle hooks; a lint warning is emitted when hooks are configured (no file is generated).
- `ignore`: none → partial — Warp has no ignore-file surface; a lint warning is emitted when ignore patterns are configured.

**Global scope only:**

- `mcp`: none → native — `agentsmesh generate --global` writes MCP servers to `~/.warp/.mcp.json` (standard `mcpServers` JSON), and `agentsmesh import --global` reads it back to canonical.
