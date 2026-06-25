---
'agentsmesh': patch
---

Fix Augment Code rule frontmatter to use the official `type` key. AgentsMesh emitted boolean flags (`always_apply: true`, `agent_requested: true`), but Augment Code rules declare their activation via a single `type` field (`type: always_apply` / `type: agent_requested`). Generation now emits `type: …`; import reads `type` and still accepts the legacy boolean keys for backward compatibility.
