# Changelog

## 0.5.0 - 2026-04-23

### Added

- **JSON Schema for all config files** — `agentsmesh.yaml`, `agentsmesh.local.yaml`, `.agentsmesh/permissions.yaml`, `.agentsmesh/hooks.yaml`, `.agentsmesh/mcp.json`, and `.agentsmesh/packs/*/pack.yaml` now ship with JSON Schemas derived directly from Zod source schemas. Enables full IDE autocomplete, enum validation, and hover docs in VS Code, JetBrains, and any YAML/JSON Language Server with zero user configuration. Schemas are published to `schemas/` in the npm package and accessible at `https://unpkg.com/agentsmesh/schemas/*.json`. Run `pnpm schemas:generate` to regenerate after schema changes.
- **`$schema` comment in generated config files** — `agentsmesh init` now writes a `# yaml-language-server: $schema=...` comment as the first line of both `agentsmesh.yaml` and `agentsmesh.local.yaml`, activating IDE validation without any manual setup.
- **Global mode** (`--global`, canonical `~/.agentsmesh/`) for **all** built-in targets — Claude Code, Cursor, Copilot, Continue, Junie, Kiro, Gemini CLI, Cline, Codex CLI, Windsurf, Antigravity, and Roo Code. Each target has a `descriptor.global` layout with project→user path rewriting, import/generate alignment, optional `~/.agents/skills/` mirroring when Codex CLI is not a global target, reference/link rewriting, and comprehensive test coverage.
- **Roo Code agents → custom modes**: canonical agents now generate `.roomodes` (project) and `settings/custom_modes.yaml` (global) with a `customModes` YAML structure. Roo Code agents capability upgraded from `—` to `partial`.
- **Copilot global extras**: `~/.copilot/AGENTS.md` is now generated in global mode as a root-instructions compat file.
- **Continue global config**: global mode generates `~/.continue/config.yaml` (aggregating rules as `rules:`, commands as `prompts:`, MCP as `mcpServers:`) and `~/.continue/AGENTS.md`.
- **Copilot global skill mirror**: skills are now mirrored to both `~/.agents/skills/` and `~/.claude/skills/` in global mode.
- **Cline global hooks round-trip**: `agentsmesh import --from cline` now reads hook scripts from `~/Documents/Cline/Hooks/` (global mode) and `.clinerules/hooks/` (project mode). Hook scripts embed a `# agentsmesh-event: <event>` metadata comment for lossless round-trip; the generator also includes this comment going forward.
- `sharedArtifacts` field added to target descriptor — enables collision-free generation when multiple targets share an output path (e.g. `.agents/skills/`).
- Lint hooks wired to all target descriptors.
- Contributor skill **`add-global-mode-target`** for scoped work when extending or validating one target’s global-mode behavior.
- Comprehensive structure validation test coverage for all 12 targets in both project and global modes.
- Shared validation helpers library (`tests/unit/targets/validation-helpers.ts`) with reusable helpers for JSON, Markdown, YAML, frontmatter, and file structure validation.

### Fixed

- **Claude Code output-styles**: generated output-style files no longer carry `agent-` / `command-` filename prefixes — now `{name}.md` as documented.
- **Windsurf**: `src/AGENTS.md` removed from `managedOutputs` (was incorrectly tracked as a managed file).
- **Cline**: `.clinerules/` directory added to `managedOutputs.dirs` for correct stale-artifact cleanup after `generate`.
- **Copilot global instructions**: path-specific instructions now aggregate into `~/.copilot/copilot-instructions.md` in global mode (previously suppressed).
- **Windsurf MCP capability**: both project and global scopes now consistently `partial` (global was incorrectly `native`).
- **Codex CLI detection**: detection paths expanded to include `AGENTS.md`, `AGENTS.override.md`, `.codex/config.toml`, `.codex/agents`, and `.codex/rules`.
- **Link rebaser**: `.agentsmesh/` anchor preserved correctly in generated prose.

### Changed

- **Init scaffold:** example files created by `agentsmesh init` are now prefixed with `_` (`_example.md`, `skills/_example/SKILL.md`). Files and directories with a `_` prefix are excluded from generation, so the starter templates serve as visible reference only and do not produce tool-specific output. `_root.md` remains the sole `_`-prefixed file that is always included in generation.
- **Documentation:** README and website updated to reflect Roo Code agents support, Copilot and Continue global extras, and the new `schemas/` package contents. `generate.mdx` documents global mode path resolution (how `--global` maps to `homedir()` as `projectRoot`).

### Refactored

- Extracted `mirrorSkillsToAgents()` shared helper (`src/targets/catalog/skill-mirror.ts`) — replaces repeated `!activeTargets.includes(‘codex-cli’)` guards inline across 8 target files.
- Consolidated import map builders; removed duplicate validation tests.
- Extracted shared skill-import pipeline; deleted obsolete `skills-helpers` files.
- Improved link rebaser resolution and managed embedding.
- Removed unused `COPILOT_GLOBAL_MCP` / `COPILOT_GLOBAL_CONFIG` constants.

## 0.3.1 - 2026-04-12

### Changed

- Refresh direct and transitive dependencies to patched releases, including guarded `pnpm` overrides for vulnerable `vite`, `picomatch`, and `brace-expansion` ranges pulled in through the toolchain.

### Fixed

- Remove the brittle `npm install -g npm@latest` step from the npm trusted-publishing workflow and run the publish job on Node 24 so release automation uses a bundled npm that already satisfies trusted-publishing requirements.
- Harden `watch` command unit-test wait budgets after the Vitest upgrade so the full suite stays stable under slower CI and coverage runs.

## 0.3.0 - 2026-04-12

### Added

- Add **Kiro** as a supported target with native project-level `AGENTS.md`, `.kiro/steering/*.md`, `.kiro/skills/*/SKILL.md`, `.kiro/hooks/*.kiro.hook`, `.kiro/settings/mcp.json`, and `.kiroignore` import/generate support.

### Changed

- Replace the appended **AgentsMesh Generation Contract** root paragraph with an installed-repo guide: `agentsmesh.yaml` / `agentsmesh.local.yaml`, what lives under `.agentsmesh`, `init` / `import` / `install` / `generate`, and maintenance commands (`diff`, `lint`, `check`, `watch`, `matrix`, `merge`). Prior shipped contract wordings remain import-compatible legacy forms so root instruction upgrades do not duplicate sections.
- `agentsmesh init --yes` now adds the same example canonical files as a normal `init`, but only for categories left empty by import. The starter target set also stays conflict-free by default, leaving `codex-cli` opt-in when projects want Codex output alongside other `AGENTS.md` targets.

### Fixed

- Fix website deployment SEO handling by deriving canonical URLs, sitemap/robots output, and optional `CNAME` generation from one deploy URL source of truth. Internal docs links now stay base-agnostic across GitHub Pages project paths and root custom domains.
- When multiple targets generate `AGENTS.md`, AgentsMesh now prefers the richer Codex output when it is a strict superset instead of failing the whole generate pass on the `codex-cli`/Kiro overlap.

## 0.2.10

### Patch Changes

- Align `agentsmesh init` default `targets` with the shared target catalog (`TARGET_IDS`) so new configs include every supported tool without a duplicate list. Shorten the AgentsMesh sourcing note appended to generated root instructions.

## 0.2.9

### Patch Changes

- Add **Roo Code** as a supported target (`.roo/` rules, commands, skills, MCP, and `.rooignore`).

## 0.2.8

### Patch Changes

- Add Antigravity as a supported target, emit Continue root rules as `.continue/rules/general.md` (while still importing legacy `_root.md`), register built-in targets through target descriptors, and align Continue e2e contracts with the new rule filename.

## 0.2.6

### Patch Changes

- d011602: Add a Starlight documentation site published to GitHub Pages; shorten the npm README and link to the hosted docs for full guides and CLI reference.

## 0.2.5

### Patch Changes

- f7a4afd: Expand the project README, and fix the sample Claude Code PostToolUse hook to use `type: prompt` with a `prompt` field instead of an invalid command-style hook after reads.

## 0.2.4

### Patch Changes

- 98bf8cb: Preserve nested canonical import paths and placeholder metadata; keep nested command picks and Cline workflow exclusions when installing packs; import Cline MCP settings from legacy `.cline/mcp_settings.json` when `cline_mcp_settings.json` is absent; refresh default `.gitignore` patterns for AgentsMesh cache and lock temp files.

## 0.2.3

### Patch Changes

- 8ae253b: Improve Codex CLI rule generation by projecting additional rules to `.codex/instructions/` and linking them from `AGENTS.md` without duplicating the root instructions file.

## 0.2.2

### Patch Changes

- d42b374: Support installing standalone skill repos (bare GitHub/GitLab URLs), use SKILL.md frontmatter name for skill identity, filter repo boilerplate from installed skills, and fix pack skill reference paths in generated output.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.1

### Changed

- npm publish now triggers after GitHub release is created, decoupling version tagging from package publishing

## 0.2.0

### Minor Changes

- bda10c7: Initial public release of AgentsMesh v0.2.0.
  One canonical `.agentsmesh/` source synced to Claude Code, Cursor, GitHub Copilot, Continue, Junie, Gemini CLI, Cline, Codex CLI, and Windsurf. Includes `init`, `generate`, `import`, `diff`, `lint`, `watch`, `check`, `merge`, `matrix`, and `install` CLI commands with full support for rules, commands, agents, skills, MCP servers, hooks, ignore patterns, permissions, local/remote extends, link rebasing, and lock-file-based collaboration.

## [0.1.0] - 2026-03-25

### Added

**CLI commands**

- `init` — Scaffold `agentsmesh.yaml`, `.agentsmesh/rules/_root.md`, and `agentsmesh.local.yaml`; auto-detect existing AI tool configs in the project
- `generate` — Sync canonical `.agentsmesh/` to target tool configs; supports `--targets`, `--dry-run`, `--force`, `--refresh-cache`, `--no-cache`
- `import --from <target>` — Import existing tool configs into canonical form; supports all 9 targets
- `diff --targets` — Show unified diff of what the next `generate` would change
- `lint --targets` — Validate canonical files and target-specific constraints with per-feature diagnostics
- `watch --targets` — Watch `.agentsmesh/` and regenerate on change with 300 ms debounce; self-generated lock file writes do not retrigger the pipeline
- `check` — Verify generated files match the lock file; designed for CI drift detection
- `merge` — Resolve `.agentsmesh/.lock` conflicts after a git merge
- `matrix --targets --verbose` — Show the feature-target compatibility table
- `install` — Install skills, rules, commands, or agents from a local path or remote GitHub/GitLab/git source; supports `--as`, `--sync`, `--dry-run`, `--force`, `--path`, `--target`, `--name`, `--extends`

**Supported targets**

Claude Code, Cursor, GitHub Copilot, Continue, Junie, Gemini CLI, Cline, Codex CLI, Windsurf

**Canonical features**

rules, commands, agents, skills, mcp, hooks, ignore, permissions

**Config**

- `agentsmesh.yaml` — project config with targets, features, and extends
- `agentsmesh.local.yaml` — local-only overrides for targets, features, and personal extends (gitignored)
- `.agentsmesh/` — canonical source directory (source of truth)
- `.agentsmesh/.lock` — generated-state lock file for `check` and `merge`

**Extends**

- Local extends (`local:path` or relative path) — merge shared configs from a relative directory
- Remote extends (`github:org/repo@tag`, `gitlab:group/repo@tag`, `git+ssh://...`) — fetch and cache in `~/.agentsmesh/cache/`

**Link rebasing**

Internal `.agentsmesh/` file references are rewritten to target-relative paths on `generate` and restored to canonical form on `import`, so supporting files and cross-skill links remain correct across all targets

**Collaboration**

- Lock file tracks checksums for all canonical features and extends
- `check` integrates with CI to catch generated file drift
- `merge` recovers from three-way lock file conflicts after `git merge`
