---
"agentsmesh": minor
---

Cursor: raise permissions to native in both scopes, fix global path to `~/.cursor/cli-config.json`.

- **Permissions (project, native)**: canonical `allow`/`deny` entries are now written to `.cursor/cli.json` (project root) and imported back, completing the round-trip. The output format is `{ "permissions": { "allow": [...], "deny": [...] } }` per the official Cursor CLI docs.
- **Permissions (global, native — path fix)**: global scope now correctly writes to `.cursor/cli-config.json` (resolved as `~/.cursor/cli-config.json`), distinct from the project-scope `.cursor/cli.json`. The previous implementation used `.cursor/cli.json` for both scopes, landing permissions at `~/.cursor/cli.json` — an undocumented path that Cursor does not read. Source: https://cursor.com/docs/cli/reference/permissions.
- **lintPermissions removed**: the stale `'Cursor permissions are partial; tool-level allow/deny may lose fidelity.'` warning no longer fires. Cursor permissions are fully round-trippable at the `native` level; emitting a partial warning was factually incorrect after the capability upgrade.
- **Importer (global scope)**: `importSettings` now reads from `.cursor/cli-config.json` when called in global scope, matching the generate path.
