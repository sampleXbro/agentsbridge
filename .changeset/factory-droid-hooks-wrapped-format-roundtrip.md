---
'agentsmesh': patch
---

Fix Factory Droid `hooks.json` format and complete its round-trip. Factory's `hooks.json` nests events under a top-level `"hooks"` key (`{ "hooks": { "PreToolUse": [{ matcher, hooks: [{ type, command }] }] } }`, per docs.factory.ai) — but generation emitted the bare top-level Claude Code shape Factory does not read, and there was no importer at all, so the declared **Native** hooks never round-tripped. Generation now wraps under `hooks` and `agentsmesh import --from factory-droid` reads it back into `.agentsmesh/hooks.yaml` (both scopes). The wrapped command-hook serialize/import logic — identical to Codex CLI's — is now a shared `wrapped-command-hooks` helper that both targets use, removing the duplication.
