---
"agentsmesh": minor
---

kiro: migrate hook schema to v1, raise hooks/global and permissions to partial

- Hook JSON schema migrated from deprecated beta format (`version:"1"`, `when`/`then`, `askAgent`/`shellCommand`) to the current Kiro v1.0.0 format (`version:"v1"`, top-level `hooks` array, `trigger`/`action` with `agent`/`command` types). Old-format hooks are no longer active in Kiro IDE v1.0.0+.
- Hook file extension renamed from `.kiro.hook` to `.json` (Kiro v1.0.0 requires `.json`).
- `globalCapabilities.hooks` raised from `none` to `partial` (global ~/.kiro/hooks/ path does not exist; hooks are workspace-only).
- `globalCapabilities.permissions` raised from `none` to `partial` (Kiro v3 CLI exposes `~/.kiro/settings/permissions.yaml`; agentsmesh does not yet generate it).
- `capabilities.permissions` (project scope) raised from `none` to `partial` (workspace permissions live at `~/.kiro/workspace-roots/<hash>/permissions.yaml`, outside the repo).
- `lintPermissions` added: emits a warning when canonical permissions are non-empty, directing users to configure permissions manually.
