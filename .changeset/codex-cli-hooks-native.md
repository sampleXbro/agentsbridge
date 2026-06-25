---
'agentsmesh': minor
---

Codex CLI hooks are now declared **Native** (project and global), correcting a `partial` mislabel. Codex CLI reads lifecycle hooks from a real on-disk file — `.codex/hooks.json` (project) and `~/.codex/hooks.json` (global) — which AgentsMesh already generates from `.agentsmesh/hooks.yaml` and imports back, so the round-trip was fully working and only the declared capability level was wrong. The support matrix (README + website) now shows Codex CLI hooks as Native.
