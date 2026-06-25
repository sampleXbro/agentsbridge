---
'agentsmesh': patch
---

Make Aider actually load the generated `CONVENTIONS.md`. Aider has no auto-discovery for `CONVENTIONS.md` — it must be referenced from `.aider.conf.yml` via the `read:` key — so the rules AgentsMesh emitted were silently ignored. Generation now also emits a project-level `.aider.conf.yml` with `read: [CONVENTIONS.md]`, merge-preserving any existing user config (other keys kept, `read` list unioned). Scoped to project mode (a home-level config's `read:` path semantics differ and are out of scope); the `.aider.conf.yml` is deterministic wiring and is not imported as canonical content.
