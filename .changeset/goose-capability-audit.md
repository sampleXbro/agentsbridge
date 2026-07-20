---
"agentsmesh": minor
---

Goose: raise commands/agents to embedded, mcp/permissions to partial, fix lintMcp scope-gate.

- **commands (project + global): none → embedded**. Canonical commands are projected as Goose skills under `.agents/skills/<name>/SKILL.md` with `name`/`description` frontmatter, discoverable by Goose's skills system at both project and global (`~/.agents/skills/`) scope.
- **agents (project + global): none → embedded**. Canonical agents are projected as skills under `.agents/skills/<agent-name>/SKILL.md`, consistent with the commands projection path.
- **mcp (project): none → partial**. Goose has no per-project MCP config file; all MCP extensions live in `~/.config/goose/config.yaml` (global, native). A lint warning is emitted when canonical MCP servers are present at project scope, directing users to configure extensions globally via `goose configure`.
- **permissions (project): none → partial**. Goose tool permissions live exclusively in `~/.config/goose/permission.yaml` (global, native). A lint warning is emitted when canonical permissions are present at project scope.
- **lintMcp scope-gate (bug fix)**. `lintMcp` previously accepted no `options` argument and always emitted a "project-level MCP is not projected" warning, even at global scope where MCP is native. The function now matches the `lintPermissions` pattern: it accepts `options?: unknown`, reads `scope` via narrowing, and returns `[]` at global scope.
