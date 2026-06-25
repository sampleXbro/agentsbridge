---
'agentsmesh': patch
---

Fix Cursor hooks being emitted in a format Cursor cannot read. AgentsMesh wrote `.cursor/hooks.json` with Claude-style PascalCase event names (`PreToolUse`) and a nested `{ matcher, hooks: [...] }` structure, but Cursor uses camelCase event names (`preToolUse`, `postToolUse`, `beforeSubmitPrompt`, …) and a flat array of hook objects — so generated hooks silently never fired. Generation and import now use Cursor's real event names and flat shape, the canonical↔Cursor mapping round-trips, and a lint warning is emitted for canonical hook events Cursor has no equivalent for.
