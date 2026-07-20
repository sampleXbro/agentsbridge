---
"agentsmesh": minor
---

Correct pi-agent capability levels based on primary-source verification of the earendil-works/pi repository.

- `mcp` (project + global): `partial` → `none`. A full recursive tree scan of the earendil-works/pi repository finds zero MCP-related source files. Pi has no native MCP config file surface — neither at project scope (`.pi/`) nor global scope (`~/.pi/agent/`). The extension system supports custom TypeScript tools and lifecycle events but not the MCP protocol. Declaring `partial` was inaccurate; `none` re-enables the silent-drop guard. The `lintMcp` stub (which falsely claimed MCP was managed via `extensions`) is removed.
- `hooks` (project + global): `none` → `partial`. Pi Agent lifecycle hooks are supported via TypeScript extensions auto-discovered from `.pi/extensions/` (project) and `~/.pi/agent/extensions/` (global). These are hand-authored code files, not a writable config surface, which justifies `partial`. A `lintHooks` warning is emitted when canonical hooks are present.
- `ignore` (project + global): `none` → `partial`. Pi has no dedicated ignore file; it relies on `.gitignore`. A `lintIgnore` warning is emitted to inform users that canonical ignore patterns are not projected.
- `permissions` (project + global): `none` → `partial`. Pi has no built-in permissions config; permissions can be implemented via extension hooks. A `lintPermissions` warning is emitted when canonical permissions are present.
