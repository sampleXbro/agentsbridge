---
'agentsmesh': minor
---

Declare Augment Code `permissions` as **Native** for global scope (was `none`). Auggie (Augment's CLI) reads tool permissions from the personal `~/.augment/settings.json` `toolPermissions` array (`[{ toolName, permission: { type: allow | deny | ask-user } }]`), mapped to canonical allow / deny / ask. Generation now emits `toolPermissions` into the global settings.json (alongside `mcpServers`/`hooks`) and import reads it back. Project scope stays `none` — per Augment's docs, tool permissions are personal/global and apply only in the CLI, not the IDE extension. (Advanced `webhook-policy` / `script-policy` / `shellInputRegex` entries have no canonical equivalent and are skipped on import.)
