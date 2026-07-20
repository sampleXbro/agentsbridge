---
"agentsmesh": minor
---

fix(junie): correct allowlist.json schema, raise hooks/global to embedded, raise permissions/project to partial

**Breaking fix — allowlist.json schema correction (permissions/global)**

`generatePermissions` previously emitted `rules` as a flat array of
`{type, name, behavior}` objects. The real `~/.junie/allowlist.json` schema
requires `rules` to be an object with four categorized sub-keys
(`fileEditing`, `executables`, `mcpTools`, `readOutsideProject`), each
containing a `rules` array of `{prefix|pattern, action}` items — no `type`,
`name`, or `behavior` field exists anywhere in the real schema. The old output
was silently ignored by Junie, making all permission rules non-functional.
Canonical allow/deny/ask entries are now mapped to the `executables` category
using `prefix` (literal) or `pattern` (glob) fields with `action: allow|ask`
(Junie has no deny action; deny is mapped to ask as the safe equivalent).

**hooks/global raised: partial → embedded**

`~/.junie/config.json` is a writable multi-feature file with a top-level
`hooks` key that Junie auto-loads. Hooks are now folded into this file via
`emitScopedSettings`. A `mergeGeneratedOutputContent` hook preserves
pre-existing keys (model, provider, brave, mcp-locations, etc.) on
regeneration. The lint warning for project-scope hooks (which require
`--config-location` and are ignored from the default project config file for
safety) is preserved.

**permissions/project raised: none → partial**

`.junie/config.json` at project scope exposes a `brave` boolean (auto-approve
mode). This is a coarse project-level permission control. A `lintPermissions`
warning is now emitted when granular allow/deny/ask rules are configured,
explaining that only the `brave` flag is available at project scope.

**generator.ts split**

Global-scope config emitters (`generatePermissions`, `emitJunieScopedSettings`,
`mergeJunieConfig`) moved to a new `global-config.ts` module to keep both
files under 200 lines.
