---
'agentsmesh': patch
---

Fix Amazon Q agent generation/import using the wrong system-prompt key. AgentsMesh wrote and read `systemPrompt`, but Amazon Q's `agent-v1.json` schema uses `prompt` — so generated `.amazonq/cli-agents/*.json` agents silently lost their system prompt. Generation now emits `prompt`; import reads `prompt` and falls back to the legacy `systemPrompt` key so previously generated agent files still round-trip.
