---
'agentsmesh': patch
---

fix(install): skip preserved boilerplate (README/LICENSE/NOTICE/COPYING/COPYRIGHT) in native descriptor import

Native-import directory mode (`runDirectory` in `descriptor-import-runner.ts`) previously materialized every `*.md` under `.claude/agents/`, `.claude/commands/`, and `.claude/rules/` as a canonical entity. Repos that ship folder-level documentation alongside content (e.g. `.claude/agents/README.md` and `.claude/agents/external/README.md` in `qdhenry/Claude-Command-Suite`) tripped the basename-slug collision check at parse time and hard-failed the install. The runner now consults `isPreservedBoilerplate` and silently drops those files — matching the existing filter applied via `entity-importers.ts` in the install-discovery path. Noise stems (`security`, `contributing`, …) are intentionally left through so user-authored rules like `.claude/rules/security.md` continue to import.
