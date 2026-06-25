---
'agentsmesh': minor
---

Declare Goose `hooks` as **Native** for both scopes (was `none`). Goose supports lifecycle hooks via the Open Plugin Specification — a `hooks/hooks.json` inside a plugin dir, auto-discovered at `.agents/plugins/agentsmesh/hooks/hooks.json` (project) and `~/.agents/plugins/agentsmesh/hooks/hooks.json` (global). The file uses the same wrapped command-hook shape as Codex CLI / Factory Droid (`{ "hooks": { "<Event>": [{ matcher?, hooks: [{ type, command }] }] } }`), so AgentsMesh now generates and imports it through the shared `wrapped-command-hooks` helper. The previous no-op `lintHooks` warning is removed.
