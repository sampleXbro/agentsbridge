---
'agentsmesh': minor
---

fix(zed): revert hooks to none, wire global skills round-trip

## Changes

**hooks: partial → none (project and global)**

Zed lifecycle hooks (agent.hooks) are a 2026 GitHub proposal (#57890,
#57943) that has never shipped. No writable hooks surface exists in any
stable or preview release. Reverted both project and global hooks capability
from 'partial' to 'none'. The lintHooks descriptor entry is removed; the
generic silent-drop-guard now issues the warning when canonical hooks are
present. The lintHooks message itself ("Zed has no lifecycle hook system")
confirmed the over-claim.

**globalCapabilities.skills: wired generator and importer (native, confirmed)**

Zed v1.4.0+ officially reads global skills from ~/.agents/skills/ (confirmed
at https://github.com/zed-industries/zed/blob/main/docs/src/ai/skills.md).
The native claim was correct per primary docs but the round-trip was broken:

- Added `ZED_GLOBAL_SKILLS_DIR = '.agents/skills'` constant (home-relative,
  same suffix as project because Zed uses the same dir name at both scopes).
- Added `skillDir: ZED_GLOBAL_SKILLS_DIR` to globalLayout so the reference
  rewriter maps skill references correctly in global scope.
- Added `.agents/skills` to `globalLayout.managedOutputs.dirs`.
- Removed the `scope === 'project'` guard in importFromZed so global import
  reads skills from .agents/skills/ (relative to the home-dir projectRoot).

The generator already emits to `.agents/skills/*` which, in global mode
(projectRoot = home dir), correctly resolves to ~/.agents/skills/*.
