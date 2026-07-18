---
'agentsmesh': patch
---

Crush: fix global-scope settings merge — `mergeGeneratedOutputContent` now also matches the global `~/.config/crush/crush.json` path, so mcp, hooks, and permissions merge into one file instead of overwriting each other in global mode.
