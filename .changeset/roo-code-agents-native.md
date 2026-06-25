---
'agentsmesh': minor
---

Declare Roo Code `agents` as **Native** for project scope (was `partial`) by adding the missing importer. AgentsMesh already generated `.roomodes` (canonical agents → Roo `customModes`); it now imports `.roomodes` back into `.agentsmesh/agents/<slug>.md`, completing the round-trip (`slug` → filename, `name`/`description` → frontmatter, `roleDefinition` → body). Global agents stay `partial` because Roo's global custom modes live in VS Code globalStorage, not an AgentsMesh-ownable file.
