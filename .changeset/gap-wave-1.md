---
'agentsmesh': minor
---

**Four capability gaps closed, all verified against each tool's own docs or source.**

**opencode: `ignore` is now generated (both scopes).** Canonical ignore patterns become `permission.read` / `permission.edit` path deny rules in `opencode.json`. The obvious-looking key, `watcher.ignore`, is deliberately *not* used — it scopes the filesystem watcher and never blocks a read, so mapping ignore there would have advertised exclusion that does not exist and left `.env` fully readable. Only deny rules are emitted and no `"*"` catch-all is written, because user rules append after opencode's built-in defaults under last-match-wins, so a generated blanket allow would silently undo opencode's own `.env` protection. `grep`/`glob` rules are left alone since they match the search string rather than the file path; the lint warning now names that residual gap instead of claiming ignore is unsupported.

**crush: global `ignore` is now generated.** `~/.config/crush/ignore` — extensionless and without a leading dot, matching what Crush's `internal/fsext/ls.go` actually reads. Generate, import and reference-rewriting all cover the global scope now.

**augment-code: project `permissions` are now generated.** Augment documents `.augment/settings.json` as repo-level settings committed to the project, carrying the same `toolPermissions` shape as the user file, so a team can check a tool policy into the repo. Honored by the Auggie CLI and Cosmos cloud agents, not the IDE extension.

**deepagents-cli: global `permissions` are now generated (embedded).** Canonical allow entries map onto `shell.allow_list` in `~/.deepagents/config.toml`, merged key-scoped so unrelated settings in that shared file survive. The mapping is lossy by nature — dcode has no deny rules, no ask rules and no per-tool patterns — so `deny` and `ask` entries now raise a lint warning naming what was dropped instead of disappearing silently.
