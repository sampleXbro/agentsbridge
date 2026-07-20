---
"agentsmesh": minor
---

Aider: raise MCP, Hooks, and Permissions from none to partial.

- **MCP (project, none → partial)**: Aider has no project-local MCP config file surface — MCP tool use is handled by Aider's own `--mcp` CLI flag or the `mcp` section of `~/.aider.conf.yml` (global user config, not a project file). `lintMcp` warns when canonical MCP servers are present but cannot be projected to the project scope. `generateMcp` returns `[]` (no-op stub satisfying the descriptor schema contract).

- **Hooks (project, none → partial)**: Aider has no file-based lifecycle hook system for projects. Lifecycle behavior is controlled via scripting (e.g. `--script` mode) rather than a writable config surface. `lintHooks` warns when canonical hooks are present but cannot be projected. `generateHooks` returns `[]`.

- **Permissions (project, none → partial)**: Aider has no writable permissions file in the project — tool allow/deny is configured via the `--allowed-cmds`/`--no-auto-accept-architect` CLI flags or user-global config, not a project-scope file. `lintPermissions` warns when canonical permissions are present but cannot be projected. `generatePermissions` returns `[]`.

All three features remain `none` at global scope (Aider's `~/.aider.conf.yml` user config exists but carries no MCP-server list, hook-event list, or structured permission blocks that map faithfully from canonical form).
