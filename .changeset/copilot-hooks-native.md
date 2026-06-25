---
'agentsmesh': minor
---

Declare GitHub Copilot `hooks` as **Native** for project scope (was `partial`). Copilot CLI auto-loads `.github/hooks/*.json` at startup, and AgentsMesh already generates `.github/hooks/agentsmesh.json` (plus wrapper scripts) and imports it back — the round-trip was fully working and only the declared level was wrong. Lint still warns about unsupported hook events and the POSIX-shell wrapper-script requirement. (Global Copilot hooks at `~/.copilot/hooks/*.json` remain a separate follow-up.)
