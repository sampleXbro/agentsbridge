---
'agentsmesh': patch
---

Fix `agentsmesh import --from factory-droid` silently dropping native droid agents. Factory Droid's `agents` capability was declared **Native** and generation already emitted `.factory/droids/<name>.md`, but the importer had no `agents` spec — so the round-trip the matrix promised never happened (import produced no `.agentsmesh/agents/*`). The descriptor now imports `.factory/droids/` (and the global `~/.factory/droids/`) back into canonical agents via the `agent` preset, completing the round-trip in both scopes.
