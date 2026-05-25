---
'agentsmesh': minor
---

refactor(install): every install-time command-directory read now delegates to per-target importer mappers

The previous skill-pack-aggregator refactor wired the target-mapper
delegation seam (`hasToolNativeCommandImporter` + `readToolNativeCommands`)
into exactly one call site: `mergeCommands`. The canonical / manual /
flat-collection install paths still routed through plain `parseCommands`
(`.md`-only), so a root-level `commands/*.toml` (Gemini CLI's native
format) on `JuliusBrussee/caveman` and similar repos was silently dropped
with a "Skipped N commands file(s) ... format: .toml" warning, even though
the gemini-cli descriptor already ships a TOML-aware mapper.

This change generalizes the seam into a single shared helper
(`readCommandsDirWithMappers`) used by every install-time read:

- **`src/install/importers/target-native-commands.ts`** gains
  `readCommandsDirWithMappers(srcDir, { restrictToTarget?, parseOpts? })`.
  When `restrictToTarget` is set (per-tool dir like `.gemini/commands/`),
  only that target's mapper runs. When unset (canonical root `commands/`),
  every registered target's non-`.md` mapper is tried; canonical `.md`
  wins on basename collision so dedup-log readability is preserved.
- **`src/canonical/load/load-canonical-slice.ts`** now returns
  `{ canonical, cleanup }` and takes an `enableTargetCommandMappers` flag.
  Install-path callers (`discoverFromContentRoot`) set it; the extends
  path leaves it off to preserve the historical `.md`-only behavior and
  avoid the tmpdir staging lifecycle (extends would need cross-load
  cleanup tracking that isn't worth the complexity for a rare edge case).
- **`src/sources/anthropic-skill-pack/merge-commands.ts`** drops its
  bespoke per-spec loop and routes every spec — canonical root `commands/`
  and per-tool dirs alike — through the shared helper.
- **`src/install/run/run-install-discovery.ts`** and
  **`src/install/manual/manual-install-discovery.ts`** merge the slice's
  staging cleanup into the existing `prep.cleanup` lifecycle.

Result on `JuliusBrussee/caveman`: install with no flags previously
produced `7 skills + 3 agents` and warned about 4 TOML commands; now
installs `7 skills + 4 commands + 3 agents`, no warning, no flag needed.
Verified end-to-end (`Installed 7 skills, 4 commands, 3 agents`).
`addyosmani/agent-skills` (the original skill-pack test) remains at
`23 skills, 8 commands, 3 agents` — no regression.

Architectural payoff: adding a future target whose commands use a
non-Markdown format is now a one-place change in that target's
descriptor. The aggregator and every install path automatically pick up
the new format via the shared seam.
