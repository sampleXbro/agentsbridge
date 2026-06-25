---
'agentsmesh': minor
---

Declare Cursor `additionalRules` as **Native** (both scopes; was `embedded`). AgentsMesh already emits each non-root rule as a separate native `.cursor/rules/<slug>.mdc` file and imports them back — identical to Cline — so the level was under-declared. No generator/importer changes; the round-trip already worked.
