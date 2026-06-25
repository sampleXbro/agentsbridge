---
'agentsmesh': patch
---

Fix `agentsmesh import --from crush --global` silently importing no MCP servers (and no hooks). The Crush config reader was scope-blind and always read `<root>/crush.json`; in global scope it now reads `~/.config/crush/crush.json` (Crush's real global config), so global MCP/hooks round-trip as the `native` matrix already claims.
