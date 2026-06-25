---
'agentsmesh': minor
---

Declare Gemini CLI `permissions` as **Native** for global scope (was `none`). Gemini's policy engine loads User-tier `~/.gemini/policies/*.toml`, and AgentsMesh's permissions generator/importer already produce and read that TOML — the global layout was simply suppressing it. Policies now emit in global mode and round-trip. Project scope stays `partial` (workspace-tier policies are disabled upstream).
