---
"agentsmesh": minor
---

Factory Droid: fix hooks output path regression and raise permissions to native.

- **Hooks (project + global, native — path corrected)**: The primary hooks surface is `.factory/hooks.json` (project) and `~/.factory/hooks.json` (global) per the official Factory Droid reference docs (`docs.factory.ai/reference/hooks-reference`). The branch had regressed this to `.factory/settings.json` (only a documented fallback when `hooks.json` is absent), which would cause generated hooks to be silently ignored whenever a real `hooks.json` exists. The generator, importer, constants, and managed-outputs arrays are restored to target `.factory/hooks.json` as the primary surface.

- **Permissions (project + global): partial → native**. `commandAllowlist` and `commandDenylist` are documented top-level keys of `.factory/settings.json` at both project and global scope (plain JSON, not GUI-only or cloud-managed). A new `generatePermissions` generator writes canonical `allow` → `commandAllowlist` and `deny` → `commandDenylist`; a new `importFactoryDroidPermissions` helper reads them back into `.agentsmesh/permissions.yaml`. The misleading lint warning (which directed users to manually edit the file we now generate) is removed.

- **`.factory/settings.json`** is now the dedicated permissions file; **`.factory/hooks.json`** is the dedicated hooks file. Both are tracked in `managedOutputs.files`.
