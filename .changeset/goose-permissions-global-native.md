---
'agentsmesh': minor
---

Declare Goose `permissions` as **Native** for global scope (was `none`). Goose reads tool permissions from `~/.config/goose/permission.yaml` — a map keyed by category where AgentsMesh owns the `user` block (`always_allow` / `ask_before` / `never_allow`, mapped to canonical allow / ask / deny). Generation emits it via `scopeExtras` and **merge-preserves** every other category (notably Goose's runtime `smart_approve` cache); import reads the `user` block back. Project scope stays `none` (Goose has no project-level permission file), and the project-scope lint warning now points users at the global file instead of claiming permissions are unsupported.
