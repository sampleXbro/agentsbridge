---
"agentsmesh": patch
---

OpenCode: fix broken AdditionalRules and Agents (both stay native).

- **AdditionalRules (project + global, native — fixed)**: `.opencode/rules/<slug>.md` files are now also declared in `opencode.json`'s `instructions` array (project: `.opencode/rules/*.md`; global: an absolute `~/.config/opencode/rules/*.md`). Per https://opencode.ai/docs/rules/, OpenCode does not auto-scan any rules directory — only `AGENTS.md`/`CLAUDE.md` auto-discover via directory traversal, and every other instruction file needs an explicit `instructions` entry. Previously the generated rule files were invisible to stock OpenCode.
- **Agents (project + global, native — fixed)**: `.opencode/agents/<slug>.md` now emits a real `permission` object (e.g. `permission: { edit: deny }`) mapped from canonical `tools`/`disallowedTools`, instead of `tools`/`disallowedTools` frontmatter keys. Per https://opencode.ai/docs/agents/, OpenCode has no `disallowedTools` key at all, and `tools` is deprecated ("Prefer the agent's permission field") and takes a boolean-map shape, not a string array — both emitted keys were silently non-functional. The importer now translates an imported `permission` object back into canonical `tools`/`disallowedTools` so the restriction round-trips (categorically, not by original tool name).
- **Fix (opencode.json merge)**: `mergeOpenCodeSettings` previously delegated to the generic Claude-shaped settings merger, which only ever carried over `permissions`(plural)/`hooks` from freshly generated content — silently freezing `mcp`/`permission`/`instructions` at whatever a first `generate` wrote, on every subsequent regenerate. It now merges OpenCode's own `mcp`/`permission`/`instructions` keys directly.
