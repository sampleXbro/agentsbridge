---
"agentsmesh": minor
---

Crush: raise Commands to embedded, Permissions to native (project + global); fix generator key, add permissions round-trip importer.

- **Commands (project + global): none → embedded**. Canonical commands are projected as skill bundles under `.crush/skills/am-command-<name>/SKILL.md` (with `x-agentsmesh-kind: command` frontmatter) via `serializeCommandSkill`. Crush has no native slash-command file format; embedded projection via `supportsConversion` is the correct level. Import recovers commands through `importEmbeddedSkills`.
- **Permissions (project + global): partial/none → native**. Canonical `allow` list maps to `permissions.allowed_tools` and `deny` list maps to `options.disabled_tools` in `crush.json` — both confirmed against the official crush schema.json (`charmbracelet/crush`) and `internal/config/config.go` (`Permissions.AllowedTools`, `Options.DisabledTools`). The generator previously wrote `permissions.denied_tools` (a non-existent field); this is corrected to `options.disabled_tools`. A new `parseCrushPermissions` function in the importer reads both fields back into canonical `permissions.yaml`, completing the native round-trip for both project scope (`crush.json`) and global scope (`~/.config/crush/crush.json`).
- **Generator fix**: `generatePermissions` now correctly emits deny-list entries under `options.disabled_tools` instead of the non-existent `permissions.denied_tools` key.
- **Lint comment updated**: file-level comment in `lint.ts` updated to reflect native support and the correct field names.
