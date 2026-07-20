---
"agentsmesh": minor
---

replit-agent: raise MCP, Hooks, Ignore, and Permissions from none to partial; add no-op generator stubs to satisfy schema contract.

- **MCP (project, none → partial)**: Replit Agent MCP servers are configured exclusively via the Integrations UI pane, not via any project-local file. `lintMcp` warns when canonical MCP servers are present but cannot be projected. `generateMcp` is a no-op stub (returns `[]`) satisfying the descriptor schema contract.

- **Hooks (project, none → partial)**: Replit Agent has no lifecycle hook file surface. Hook state transitions (Draft, Active, Queued, etc.) are internal platform states, not user-writable hooks. `lintHooks` warns when canonical hooks are present but cannot be projected. `generateHooks` is a no-op stub (returns `[]`).

- **Ignore (project, none → partial)**: Replit Agent has no dedicated ignore file (no `.replitignore` or similar). The agent relies on `.gitignore` for version-control purposes, but no Replit-specific file-based ignore surface exists. `lintIgnore` warns when canonical ignore patterns are present but cannot be projected. `generateIgnore` is a no-op stub (returns `[]`).

- **Permissions (project, none → partial)**: Replit Agent permissions are managed in the cloud UI with no writable file surface in the project. `lintPermissions` warns when canonical permissions are present but cannot be projected. `generatePermissions` is a no-op stub (returns `[]`).

All primary-doc claims verified against https://docs.replit.com/references/mcp/overview, https://docs.replit.com/replitai/agent, https://docs.replit.com/references/agent/task-lifecycle, and https://docs.replit.com/replitai/replit-dot-md.
