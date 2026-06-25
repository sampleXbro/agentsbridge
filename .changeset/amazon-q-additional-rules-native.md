---
'agentsmesh': minor
---

Declare Amazon Q `additionalRules` as **Native** for project scope. AgentsMesh already emits each non-root rule as a separate `.amazonq/rules/<slug>.md` file (which Amazon Q auto-loads) and imports them back, so the capability was under-declared as `none`. Global scope stays `none` because Amazon Q has no global rules directory on disk (`~/.aws/amazonq/` is used only for MCP and agents).
