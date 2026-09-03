---
'agentsmesh': patch
---

**Disabling a feature no longer deletes the user config file that feature wrote into.**

`cleanupStaleGeneratedOutputs` treated every entry in a target's `managedOutputs.files` as agentsmesh-owned: any path the current run did not emit was `rm -rf`'d. A run with `mcp` turned off emits nothing for `.codex/config.toml`, so the file — the user's own Codex model, provider and trust config — was deleted outright, and the CLI reported "Nothing changed."

`TargetManagedOutputs` now has a second list:

- `files` — agentsmesh owns the file outright; a run that stops emitting it deletes it (this is how revocation works).
- `coOwnedFiles` — agentsmesh writes into the file but the user owns it too. Never deleted; the descriptor's `mergeGeneratedOutputContent` hook keeps the user's content on the runs that do write it.

31 paths across 18 targets moved from `files` to `coOwnedFiles`: `.codex/config.toml`, `.mcp.json` / `~/.claude.json`, `.claude/settings.json`, `.vscode/mcp.json`, `.vscode/settings.json`, `.gemini/settings.json`, `.qwen/settings.json`, `crush.json`, `opencode.json`, `kilo.jsonc`, `.amp/settings.json`, `.augment/settings.json`, `.agents/mcp_config.json`, `.openhands/hooks.json`, `.deepagents/.mcp.json`, `.junie/config.json`, `.rovodev/config.yml`, `~/.config/goose/permission.yaml` and their global counterparts.

Stale cleanup reads `files` only, and skips `coOwnedFiles` during the directory sweep too — a co-owned file living inside a managed directory was otherwise still deleted.

A repo-wide invariant test now fails the build if any registered descriptor — builtin or plugin — lists a co-owned path in `managedOutputs.files`. Co-ownership is recognised through all three mechanisms agentsmesh actually uses: a descriptor `mergeGeneratedOutputContent` hook, the `SETTINGS_JSON_PATHS` fallback in `mergeOutputContent`, and a `scopeExtras` generator that reads the existing file and merges internally. The last two are why `.claude/settings.json` (the user's model, env and hook config) and goose's `permission.yaml` (which holds goose's own `smart_approve` cache) were still being deleted after the first pass — neither has a descriptor hook. Exceptions are an explicit, commented allowlist.

**Behaviour change:** emptying `hooks.yaml` no longer removes `.openhands/hooks.json`. That file is user-authored and holds `HookType.AGENT` handlers canonical cannot express; a feature-disable run and an empty-canonical run are indistinguishable at cleanup time, so the file is kept. Revocation is still event-scoped — rewriting `hooks.yaml` drops the handlers agentsmesh no longer emits.

**Known gap:** `agentsmesh uninstall` relied on stale cleanup deleting these files, so agentsmesh's own `mcpServers` / `[mcp_servers.*]` blocks now survive an uninstall in a co-owned file instead of going with it. The same applies to disabling a feature. Leaving a stale server behind is the safer failure than deleting the user's model and auth config, but it is not the end state: revoking owned keys on disable needs an explicit clear-owned-keys pass across all 31 paths (`src/targets/pi-agent/permissions-revoke.ts` is the existing precedent) and is not in this change.

**Plugin authors:** `coOwnedFiles` is optional and additive. Any path your `mergeGeneratedOutputContent` claims belongs there rather than in `files`; the schema rejects a path listed in both.
