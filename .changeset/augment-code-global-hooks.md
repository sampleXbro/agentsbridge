---
"agentsmesh": minor
---

Augment Code: raise global Hooks from none to native.

- **Hooks (global, none → native)**: `~/.augment/settings.json` supports the same `hooks` key as the project-scope `.augment/settings.json` — the `buildSettingsContent` helper already serialises canonical hooks into AugmentCode's native format (`{ event: [{ matcher, hooks: [{ type, command, timeout }] }] }`), and `importAugmentSettings` already reads them back. The global capability was previously declared `none` even though generation and import were already wired. Only the `globalCapabilities.hooks` declaration needed to change from `none` to `native`; no code changes were required.

- **Project hooks (native — unchanged)**: project-scope hooks were already `native` and are unaffected.
