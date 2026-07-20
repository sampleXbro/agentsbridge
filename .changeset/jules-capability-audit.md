---
"agentsmesh": minor
---

Jules: raise Commands, MCP, Hooks, Ignore, and Permissions from none to partial; fix engine ignore-dispatch gap.

- **Commands (project, none → partial)**: Jules has no slash-command or prompt-file mechanism. Tasks are submitted via GitHub issues or the web UI. No commands config file surface exists. `lintCommands` warns when canonical commands are present but cannot be projected.

- **MCP (project, none → partial)**: No MCP configuration surface is mentioned anywhere in Jules documentation. Jules is cloud-hosted with no writable file surface for MCP. `lintMcp` warns when canonical MCP servers are present but cannot be projected.

- **Hooks (project, none → partial)**: Jules has no lifecycle hook system. It is async and cloud-based with no local hook execution mechanism. `lintHooks` warns when canonical hooks are present but cannot be projected.

- **Ignore (project, none → partial)**: Jules has no dedicated ignore file (no `.julesignore` or similar surface). It is a cloud agent with no local ignore mechanism. `lintIgnore` warns when canonical ignore patterns are present but cannot be projected.

- **Permissions (project, none → partial)**: Jules has no permissions configuration file. Permission-like controls exist only via GitHub PR review workflows (GUI), not a writable file. `lintPermissions` warns when canonical permissions are present but cannot be projected.

- **Engine fix — ignore dispatch gap (linter.ts)**: `descriptor.lint?.ignore` was never dispatched by the engine. The `lintSilentFeatureDrops` guard only fires for `capability.level === 'none'`, so promoting ignore from `none` to `partial` silently dropped the only warning path. The engine now dispatches `descriptor.lint?.ignore` when the `ignore` feature is enabled, matching how commands, mcp, permissions, and hooks are dispatched. This fix applies to all targets with `ignore: 'partial'` and a `lint.ignore` hook.

All primary-doc claims verified against https://jules.google/docs.
