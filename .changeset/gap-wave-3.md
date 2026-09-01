---
'agentsmesh': minor
---

**Twelve capability gaps closed across Zed and Antigravity — and a bug that deleted your Zed editor config.**

**Zed.** Global rules now write `~/.config/zed/AGENTS.md`, the real file that replaced the database-backed Rules Library in v1.4.0, with secondary rules folded into it. Ignore projects onto `file_scan_exclusions` and `private_files` in `settings.json` at both scopes — `file_scan_exclusions` is a splicing list, so the `"..."` entry is appended to preserve Zed's own defaults, while `private_files` extends and must not carry it. Global permissions write `agent.tool_permissions`, mapped onto the five Zed tools that accept patterns, with `case_sensitive: true` so Zed's case-insensitive default cannot widen a grant. Commands ride the skills surface through the existing `supportsConversion` mechanism, emitting byte-identical output to codex-cli so the two dedupe instead of colliding. Project permissions are now correctly `none`: `.zed/settings.json` is parsed as `ProjectSettingsContent`, which has no `agent` field at all, so anything written there was discarded.

**Antigravity.** Project MCP is generated again — it had been deliberately suppressed, so every developer re-added their servers by hand in each repo — along with project and global agents, and `.antigravityignore`. Global permissions write `~/.gemini/antigravity-cli/settings.json`. Agent files are merged per server key, so `disabled`, `disabledTools`, `cwd` and `oauth` survive regeneration.

Three fixes to behaviour that was already shipping:

- **`agentsmesh generate` could delete your entire Zed editor config.** `.zed/settings.json` was listed in `managedOutputs.files`, so any run that produced no MCP servers treated it as a stale artifact and removed it. Neither Zed settings file is a managed output any more.
- **Zed generation overwrote hand-written permission rules.** Merging was per-tool whole-list replace. Ownership is now per pattern, decided by whether a rule decodes cleanly back to canonical — so `^cargo\s+(build|test)$`, `^sudo` and anything malformed survive every run, while agentsmesh's own grants are still revoked when removed from canonical.
- **Zed and Antigravity imports overwrote canonical files.** Importing merges now: ignore entries match by glob rather than line text, so `dist/` is recognised in `**/dist` instead of churning, and canonical entries the target cannot express are preserved rather than dropped.

Zed reads `settings.json` as JSONC and its default file is mostly comments, which `JSON.stringify` would destroy. agentsmesh now leaves a non-strict-JSON settings file completely untouched rather than rewriting it without the user's comments — safer than the previous behaviour, which replaced it with `{}`.
