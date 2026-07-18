---
'agentsmesh': minor
---

fix(windsurf): raise additionalRules global partial→embedded, add permissions partial, add unit tests

## Changes

**globalCapabilities.additionalRules: partial → embedded (global scope)**

Windsurf's global additional rules are embedded into the single aggregate file
`~/.codeium/windsurf/memories/global_rules.md` (confirmed by official Devin Desktop
documentation at https://docs.devin.ai/desktop/cascade/memories). Per-rule files do
not exist at global scope. `renderWindsurfGlobalInstructions` is now wired as
`globalLayout.renderPrimaryRootInstruction` and appends non-root rules via
`appendEmbeddedRulesBlock`. Branch coverage tests added to
`tests/unit/targets/windsurf/rules-branches.test.ts`.

**permissions: none → partial (project and global scopes)**

`windsurf.cascadeCommandsAllowList` and `windsurf.cascadeCommandsDenyList` are real
VS Code extension settings (documented at https://docs.windsurf.com/windsurf/terminal).
The settings surface is real but does not meet the native threshold: no official
documentation specifies a writable file path or workspace-scope support for these keys —
all docs reference "Command Palette → Open Settings (UI)". Partial is the accurate level
for both scopes. `lintPermissions` is added to both the project and global descriptor
lint hooks to emit a warning when canonical permissions are present. Branch coverage tests
added to `tests/unit/targets/per-target-lint-branches-2.test.ts`.

**Deferred: .devin/rules/ path (Devin Desktop rebrand)**

Windsurf rebranded to Devin Desktop on June 2 2026. The new preferred workspace rules
directory is `.devin/rules/` (`.windsurf/rules/` is kept as legacy fallback per official
docs). The importer, generator, import-maps, and detection paths have not been updated to
support `.devin/rules/`. This is a deferred follow-up tracked separately; the `native`
level for `additionalRules` at project scope remains accurate because `.windsurf/rules/`
is still read by Devin Desktop.
