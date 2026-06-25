---
'agentsmesh': minor
---

Declare Continue `permissions` as **Native** for global scope (was `none`). Continue reads personal tool permissions from `~/.continue/permissions.yaml` (top-level `allow` / `ask` / `exclude` arrays of tool-matcher patterns); AgentsMesh now generates that file in global mode and imports it back, mapping `exclude` ↔ canonical `deny`. Project scope stays `none` — Continue's own spec marks project-level permissions "not implemented yet".

Also: the descriptor schema now accepts a target's `globalSupport.scopeExtras` as a valid implementation of a settings-backed capability (mcp/hooks/ignore/permissions) at global scope, since `scopeExtras` is the global-only emit path Continue uses.
