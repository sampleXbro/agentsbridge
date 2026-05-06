# Changelog

## 0.13.0

### Minor Changes

- f68ab67: feat(cli): add convert command for direct tool-to-tool migration

  Adds `agentsmesh convert --from <source> --to <target>` for direct tool-to-tool conversion without going through canonical setup. Internally chains the existing import and generate pipelines via a temporary directory, producing destination tool files from source tool files in a single command. Supports `--dry-run` and `--json` flags.

- c8d58c0: feat(cli): add structured JSON output mode

  Adds `--json` support across CLI commands so automation and CI can consume stable machine-readable command results. JSON mode returns structured success/error envelopes while keeping the existing human-readable output as the default.

## 0.12.0

### Minor Changes

- 11c0d58: feat(amp): add Amp (Sourcegraph) as a new built-in target

  Amp is a coding agent by Sourcegraph (ampcode.com). This adds full project and global mode support:
  - **Rules**: `AGENTS.md` (root + embedded additional rules)
  - **Skills**: `.agents/skills/*/SKILL.md` skill bundles (shared path with Codex CLI, consumer role)
  - **MCP**: `.amp/settings.json` under `amp.mcpServers` key with settings merge
  - **Global mode**: `~/.config/amp/AGENTS.md`, `~/.config/amp/skills/`, `~/.config/amp/settings.json`
  - Commands and agents projected as skills via `supportsConversion`
  - Lint warnings for unsupported features (hooks, ignore, permissions)

- fa8e208: feat(warp): add Warp as a new built-in target

  Warp is an agentic development environment by Warp.dev. This adds project and global mode support:
  - **Rules**: `AGENTS.md` (root + embedded additional rules); legacy `WARP.md` supported on import
  - **Skills**: `.warp/skills/` with YAML frontmatter skill bundles
  - **MCP**: `.mcp.json` at project root (standard format, shared with Claude Code)
  - **Commands/Agents**: projected as skills via `supportsConversion`
  - **Global mode**: `~/.warp/skills/` (skills only — global rules are UI-managed via Warp Drive)
  - Lint warnings for unsupported features (hooks, ignore, permissions)

- bfc0a57: feat(zed): add Zed as a new built-in target

  Zed is a modern code editor with a built-in AI assistant (zed.dev). This adds project and global mode support:
  - **Rules**: `.rules` (root + embedded additional rules in a single file)
  - **MCP**: `.zed/settings.json` under `context_servers` key with settings merge
  - **Global mode**: `~/.config/zed/settings.json` (MCP only — no global rules file)
  - Lint warnings for unsupported features (hooks, ignore, permissions)

## 0.11.0

### Minor Changes

- 85b8601: feat(goose): add Goose (Block) as a new built-in target

  Goose is an open-source AI coding agent by Block (goose-docs.ai). This adds full project and global mode support:
  - **Rules**: `.goosehints` (root + embedded additional rules)
  - **Skills**: `.agents/skills/*/SKILL.md` skill bundles (shared path with Codex CLI)
  - **Ignore**: `.gooseignore` with gitignore-style patterns
  - **Global mode**: `~/.config/goose/.goosehints`, `~/.config/goose/.gooseignore`, `~/.agents/skills/`
  - Lint warnings for unsupported features (commands, hooks, MCP, permissions)

- ca7e48f: feat(opencode): add OpenCode as a new built-in target

  OpenCode (opencode.ai) is an open-source AI coding agent CLI/TUI. This adds full project and global mode support:
  - **Rules**: `AGENTS.md` (root) + `.opencode/rules/*.md` (additional)
  - **Commands**: `.opencode/commands/*.md` with description frontmatter
  - **Agents**: `.opencode/agents/*.md` with mode/description/model frontmatter
  - **Skills**: `.opencode/skills/*/SKILL.md` skill bundles
  - **MCP**: `opencode.json` with native format conversion (array `command`, `environment` key)
  - **Global mode**: `~/.config/opencode/` with full feature parity
  - Lint warnings for unsupported features (hooks, ignore, permissions)

## 0.10.0

### Minor Changes

- c4fb261: Add `kilo-code` as a new built-in target. Kilo Code is a multi-surface AI coding platform (VS Code extension, JetBrains plugin, CLI, cloud agent) and a fork of Roo Code (which is a fork of Cline).

  Generation always uses Kilo's new layout: `AGENTS.md` (root), `.kilo/rules/`, `.kilo/commands/`, `.kilo/agents/` (first-class subagents), `.kilo/skills/`, `.kilo/mcp.json`, and `.kilocodeignore`. Import covers BOTH the new layout and Kilo's legacy layout (`.kilocode/`, `.kilocodemodes`) so existing kilo / Roo-era projects round-trip cleanly.

  Capabilities (project + global):
  - `rules`, `additionalRules`, `commands`, `agents`, `skills`, `mcp`, `ignore`: native
  - `hooks`: none — Kilo Code has no user-facing lifecycle hook system; canonical hooks emit a lint warning.
  - `permissions`: none — Kilo permissions live in `kilo.jsonc`, which agentsmesh does not generate in v1; canonical permissions emit a lint warning.

  Global mode generates under `~/.kilo/` (`AGENTS.md`, `rules/`, `commands/`, `agents/`, `skills/`, `mcp.json`) plus `~/.kilocodeignore`, and mirrors skills into `~/.agents/skills/` for cross-tool compatibility (suppressed when `codex-cli` is also active).

  Use `agentsmesh import --from kilo-code` to migrate existing Kilo projects (new or legacy layout) into canonical `.agentsmesh/`, then `agentsmesh generate --targets kilo-code` to project them back as the documented new layout.

- 5d6cfbb: Sequential `agentsmesh import --from <target>` runs now merge MCP servers by name into `.agentsmesh/mcp.json` instead of replacing the whole file. Existing canonical entries are preserved and the imported set wins on name collision, so a `claude-code` import followed by a `cursor` import keeps both targets' servers in canonical state.

  Affects every importer that writes `mcp.json`: `claude-code` (`.claude/settings.json` + `.mcp.json` + `~/.claude/.mcp.json`), `codex-cli` (`config.toml`), `continue`, `cursor`, and any descriptor-driven importer using `mode: 'mcpJson'`. The previous behavior — last import overwrites the file and silently drops earlier servers — is gone.

  Also fixed: a build-time regression where `writeMcpWithMerge` was referenced by five importers without the backing module being shipped, breaking `tsc --noEmit` for consumers building from source.

## 0.9.0

### Minor Changes

- b3f702d: Adds three new `agentsmesh lint` diagnostics, a recommended `.gitignore` policy for materialized packs, and a one-step `agentsmesh target-scaffold` workflow.

  Added:
  - New lint diagnostics, all emitted as warnings (do not change `lint`'s exit code):
    - `silent-drop-guard` flags canonical content a target would otherwise drop without trace based on its capability map.
    - `hook-script-references` warns when a hook command references a script path for any target whose generator does not copy hook scripts into its output. **All built-in targets except Copilot fall under this rule today.** Existing hook configs that reference local script paths (e.g. `./scripts/pre-commit.sh`) will surface a new warning per matching target on the first lint after upgrade. The script must already exist relative to the hook execution directory or the generated config will fail at runtime — the diagnostic just makes the gap visible.
    - `rule-scope-inversion` catches manual-activation rules whose scope contradicts the target's projection rules.
      All three are wired into `runLint` for every target via descriptor capabilities; no existing rule has been removed and no diagnostic is upgraded to error severity.
  - `agentsmesh init` now writes `.agentsmesh/packs/` into `.gitignore` alongside `agentsmesh.local.yaml`, `.agentsmeshcache`, and `.agentsmesh/.lock.tmp`, and skips entries already covered by a broader pre-existing pattern (e.g. an existing `.agentsmesh/` line covers `.agentsmesh/packs/`). Materialized packs are treated like `node_modules` — `installs.yaml` is committed and `agentsmesh install --sync` reproduces the tree deterministically post-clone.
  - `agentsmesh target-scaffold` post-steps collapse the previous three-edit sequence into one `pnpm catalog:generate` invocation, backed by a new auto-discovered builtin-target catalog (`scripts/generate-target-catalog.ts` + `pnpm catalog:verify` drift guard in CI).

  Changed:
  - The `agentsmesh.json` and `pack.json` schemas now list `targets` enums alphabetically. Schema consumers that pin order will see a one-time diff; values are unchanged.
  - README documents the commit-vs-gitignore convention for generated tool folders and clarifies native Windows support (no WSL).

  Internal:
  - Per-target importers (`antigravity`, `claude-code`, `continue`, `copilot`, `cursor`, `gemini-cli`, `junie`, `kiro`, `roo-code`) migrated to the descriptor-driven import runner with mapper functions extracted into `import-mappers.ts` to keep `index.ts` ↔ `importer.ts` cycles out of the TDZ.
  - New shared link-format registry (`src/core/reference/link-format-registry.ts`) consolidates per-target link rendering rules.
  - `writeFileAtomic` now refuses to follow a pre-existing symlink at the target path (closes a TOCTOU window where a swapped symlink could redirect writes outside the project tree).
  - `agentsmesh plugin add` now warns that plugins load as trusted Node.js modules with full process privileges.

### Patch Changes

- 08ef1b0: Security hardening and correctness fixes across install, generate, reference rewriting, plugin loading, and caching subsystems.

  Fixed:
  - `agentsmesh install --path` now rejects paths that traverse outside the install source root, closing a directory-escape vulnerability where `--path ../../outside` could read files outside the fetched source.
  - Pack names are validated as single directory segments before materialization — values containing path separators (e.g. `../../escape`) are rejected, preventing writes outside `.agentsmesh/packs/`.
  - `writeFileAtomic` now checks the `.tmp` staging path for symlinks before writing, closing a TOCTOU window where a symlink at `${path}.tmp` could redirect writes to an attacker-controlled location.
  - `agentsmesh generate --targets` now validates filter values against configured targets and errors on unknown names. Previously a misspelled target silently produced zero outputs and `--check` reported success, allowing CI to pass while checking nothing.
  - Project-scope skill mirrors now receive source-map entries for reference rewriting. Previously only global-scope mirrors were mapped, leaving Markdown links inside project-mirrored skill files unrewritten.
  - Plugin targets declaring `sharedArtifacts` are now recognized during global reference rewriting. Previously only builtin target descriptors were consulted, so plugin-owned shared paths could be rebased through the wrong artifact map.
  - `runDescriptorImport` is now exported from `agentsmesh/targets` as documented in the plugin guide.
  - Importer fallback sources are now tried when configured primary files are absent on disk, not only when the primary source list is empty.
  - `flatFile` and `mcpJson` import modes now honor `canonicalDir` when `canonicalFilename` is a bare filename, matching the documented directory-plus-filename contract for plugin descriptor authors.
  - Rule path mapping uses POSIX `basename` with backslash normalization instead of host `node:path`, preventing broken slugs when Windows-shaped canonical paths appear on a POSIX host.
  - Relative `file:` plugin sources now resolve against `projectRoot` instead of the filesystem root.
  - Remote cache keys now preserve dots and use double-separator delimiters so distinct refs like `v1.0.0` and `v1_0_0` no longer collide. Existing cached entries will be re-fetched once after upgrade.

## 0.8.0

### Minor Changes

- b3f702d: Adds three new `agentsmesh lint` diagnostics, a recommended `.gitignore` policy for materialized packs, and a one-step `agentsmesh target-scaffold` workflow.

  Added:
  - New lint diagnostics: `silent-drop-guard` flags canonical content a target would otherwise drop without trace, `hook-script-references` reports hook commands pointing at missing wrapper scripts, and `rule-scope-inversion` catches manual-activation rules whose scope contradicts the target's projection rules. They are wired into `runLint` for every target via descriptor capabilities, so existing configs may surface new warnings; no rule has been removed.
  - `agentsmesh init` now writes `.agentsmesh/packs/` into `.gitignore` alongside `agentsmesh.local.yaml`, `.agentsmeshcache`, and `.agentsmesh/.lock.tmp`. Materialized packs are treated like `node_modules` — `installs.yaml` is committed and `agentsmesh install --sync` reproduces the tree deterministically post-clone.
  - `agentsmesh target-scaffold` post-steps collapse the previous three-edit sequence into one `pnpm catalog:generate` invocation, backed by a new auto-discovered builtin-target catalog (`scripts/generate-target-catalog.ts` + `pnpm catalog:verify` drift guard in CI).

  Changed:
  - The `agentsmesh.json` and `pack.json` schemas now list `targets` enums alphabetically. Schema consumers that pin order will see a one-time diff; values are unchanged.
  - README documents the commit-vs-gitignore convention for generated tool folders and clarifies native Windows support (no WSL).

  Internal:
  - Per-target importers (`antigravity`, `claude-code`, `continue`, `copilot`, `cursor`, `gemini-cli`, `junie`, `kiro`, `roo-code`) migrated to the descriptor-driven import runner with mapper functions extracted into `import-mappers.ts` to keep `index.ts` ↔ `importer.ts` cycles out of the TDZ.
  - New shared link-format registry (`src/core/reference/link-format-registry.ts`) consolidates per-target link rendering rules.

## 0.7.0

### Minor Changes

- 5179de0: Native Windows support is now first-class. `windows-latest` × Node 22 joins `ubuntu-latest` × Node 20/22/24 and `macos-latest` × Node 22 in the CI quality matrix, the `os: ["darwin", "linux"]` restriction is removed from `package.json`, and the README/website call out Linux, macOS, and Windows as equally supported platforms.

  The install/pack persistence layer is now separator-agnostic: `installs.yaml` `source`/`path`/`paths` and `pack.yaml` local-source fields are always serialized as POSIX through the new `src/install/core/portable-paths.ts` helper, regardless of the host separator. `agentsmesh install <local-path>` parses Windows paths (including cross-drive sources and `.agentsmesh/` segments split by backslashes) into portable manifest entries, and legacy manifests written on Windows are normalized on read so existing repos converge without migration. `agentsmesh import --from windsurf` and `--from codex-cli` now detect nested `AGENTS.md` / `AGENTS.override.md` via `basename(srcPath)`; the previous `srcPath.endsWith('/AGENTS.md')` check silently skipped nested rules on Windows because `readDirRecursive` returns native separators. `scripts/flake-check.ts` resolves `pnpm.cmd` on `win32`, and `tests/helpers/node-bin.ts` is the single source for `node_modules/.bin/<name>` shim resolution across platforms.

  A new Windows path-safety contract (`src/utils/filesystem/windows-path-safety.ts` plus `tests/contract/windows-path-safety.matrix.test.ts`) asserts that every generated artifact path emitted by every builtin target — in both project and global scope — survives a Windows clone/checkout/write cycle. Reserved device names (case-insensitive `CON`/`PRN`/`AUX`/`NUL`/`COM1-9`/`LPT1-9`), reserved characters (`<>:"|?*` plus ASCII control chars), trailing dots/spaces, and case-only collisions on default NTFS / APFS volumes are now regression-locked across 48 contract assertions.

  `agentsmesh lint` warns when `hooks.yaml` is non-empty for `cline` or `copilot`, because both targets emit `.sh` wrapper scripts (`.clinerules/hooks/*.sh`, `.github/hooks/scripts/*.sh`) with `#!/usr/bin/env bash` headers that need a POSIX shell (git-bash or WSL) to execute on Windows. Other targets (claude-code, cursor, windsurf, kiro, gemini-cli) embed the user's `command` string directly into JSON config and stay fully portable. The Windows portability story for hooks is documented in `website/src/content/docs/canonical-config/hooks.mdx`.

  Also fixed: `tests/integration/lint.integration.test.ts` stops hardcoding `shell: '/bin/sh'` plus `2>&1` for stderr capture (which ENOENTed on Windows runners) — it now spawns `process.execPath` via `spawnSync` and concatenates the captured streams.

  Fixed a long-latent race in `acquireProcessLock` (`src/utils/filesystem/process-lock.ts`) that surfaced the test failure `ENOENT: rename .agentsmesh/.lock.tmp -> .agentsmesh/.lock` under parallel `agentsmesh generate` invocations. Between `mkdir(lockPath)` succeeding and `writeFile(holder.json)` completing, a competing acquirer would treat the metadata-less lock dir as orphaned, evict it, and silently steal the mutex — letting both processes into the critical section and racing their `writeFileAtomic` writes. The lock now treats lock dirs younger than a 2-second grace window as held even when `holder.json` is missing, and only evicts genuinely orphaned older directories. Covered by `tests/integration/generate-process-lock.integration.test.ts` plus a new unit test in `tests/unit/utils/process-lock.test.ts`.

  Fixed a generator-side Windows path bug surfaced by the Windows CI matrix: rule slug extraction in `src/targets/{claude-code,codex-cli,copilot,cursor,continue,catalog}/...` used `rule.source.split('/').pop()!.replace(/\.md$/, '')`, which on Windows where `rule.source` uses `\` separators returned the _entire absolute path_ and produced `.cursor\rules\C:\Users\...\.agentsmesh\rules` ENOENT crashes during `writeFileAtomic`. All 10 occurrences across 8 files now use `basename(rule.source, '.md')` from `node:path`, which is platform-aware. Watch mode in `src/cli/commands/watch.ts` now sets `usePolling: process.platform === 'win32'` because Windows native `ReadDirectoryChangesW` misses events for files newly created in just-watched subdirectories under the GitHub Actions `AppData\Local\Temp` short-name path.

  Fixed a second Windows path bug in the reference rewriter: `buildArtifactPathMap`, `addPackSkillArtifactMappings`, `applyCopilotInstructionArtifactRefs`, `collectPlannedPaths`, and the validator in `src/core/reference/validate-generated-markdown-links.ts` were using native `node:path.join`/`normalize` directly. The rebaser itself uses `pathApi(projectRoot)` which picks `win32` or `posix` based on the _path format_, not the host platform. Synthetic POSIX project roots (used in unit tests) and real Windows project roots could produce mismatched keys vs. lookups, so the rewriter silently no-op'd. All five sites now share one `pathApi(projectRoot)` so map keys and lookups always agree.

## 0.6.0 - 2026-04-25

### Added

- **Full plugin parity with built-in targets** — plugin targets now have access to the same runtime capabilities as built-in targets:
  - **Conversion support**: plugins can declare `supportsConversion: { commands: true, agents: true }` and users can configure `commands_to_skills` / `agents_to_skills` for plugin target IDs in `agentsmesh.yaml`. The conversion schema now accepts arbitrary target IDs alongside hardcoded builtins. Conversion values support per-scope control: `foo-ide: { project: true, global: false }` or the shorthand `foo-ide: true` for both scopes.
  - **Global mode**: plugin descriptors that define `global` or `globalSupport` layouts, `globalCapabilities`, and `globalDetectionPaths` are fully resolved by the engine — `generate --global`, `import --global`, `lint --global`, and `matrix --global` all work with plugin targets.
  - **Scoped settings emission**: `emitScopedSettings` hooks on plugin descriptors are now called during generation (previously only checked on builtins).
  - **Hook post-processing**: `postProcessHookOutputs` hooks on plugin descriptors are now called during the hook generation pass.
  - **Per-feature lint hooks**: `lint.commands`, `lint.mcp`, `lint.permissions`, `lint.hooks`, and `lint.ignore` on plugin descriptors receive `{ scope }` context for project vs global differentiation.
  - **Unified generator resolution**: a single code path (`resolveTargetFeatureGenerator`) resolves generators for both builtins and plugins, removing duplicate resolution logic from the engine.
- **Plugin support in all CLI commands** — `diff`, `check`, `matrix`, and `import --from <plugin-id>` now bootstrap and resolve plugin targets. Previously only `generate` and `lint` supported plugins.
- **Richer target scaffold** — `agentsmesh target scaffold` now generates descriptors with global layout, `globalCapabilities`, `globalDetectionPaths`, `supportsConversion`, per-feature lint hook stubs, and `rewriteGeneratedPath` for global path rewriting.
- **Comprehensive plugin test fixture** (`tests/fixtures/plugins/rich-plugin/`) — covers 100% of `TargetDescriptor` fields including all 8 feature generators, per-feature lint hooks, project and global layouts with output families, shared artifacts, scope extras, scoped settings, hook post-processing, and conversion support.
- **Typed root barrel export** — `import { generate, importFrom, loadCanonical, registerTargetDescriptor } from 'agentsmesh'` now resolves to a proper `.d.ts` under strict TypeScript. The root `exports."."` is a conditional block with `types`, `import`, and `default`, pointing at a new public barrel (`src/public/index.ts`). Closes `TS7016: Could not find a declaration file for module 'agentsmesh'` that appeared for any downstream TS consumer.
- **Typed error taxonomy exported from the public API** — `AgentsMeshError` base class plus 8 concrete subclasses (`ConfigNotFoundError`, `ConfigValidationError`, `TargetNotFoundError`, `ImportError`, `GenerationError`, `RemoteFetchError`, `LockAcquisitionError`, `FileSystemError`), each carrying a stable `code` field (`AM_CONFIG_NOT_FOUND`, `AM_CONFIG_INVALID`, `AM_TARGET_NOT_FOUND`, `AM_IMPORT_FAILED`, `AM_GENERATION_FAILED`, `AM_REMOTE_FETCH_FAILED`, `AM_LOCK_ACQUISITION_FAILED`, `AM_FILESYSTEM`). Programmatic consumers can branch on `err instanceof ConfigNotFoundError` or `err.code === 'AM_CONFIG_INVALID'` without parsing error message strings. Error throw sites in `src/config/core/loader.ts` and `src/utils/filesystem/fs.ts` now emit typed errors; stack-trace context and `cause` chains preserved.
- **Canonical domain types in the public barrel** — 14 types (`CanonicalFiles`, `CanonicalRule`, `CanonicalCommand`, `CanonicalAgent`, `CanonicalSkill`, `SkillSupportingFile`, `Permissions`, `IgnorePatterns`, `McpServer`, `StdioMcpServer`, `UrlMcpServer`, `McpConfig`, `Hooks`, `HookEntry`) are now exported from `agentsmesh` and `agentsmesh/canonical`. Programmatic consumers can finally type the result of `loadCanonical()` without reaching into internal modules.
- **Process-level lock for concurrent `generate`** — `agentsmesh generate` acquires an atomic mkdir-based lock at `.agentsmesh/.generate.lock` before writing. Concurrent generates serialize cleanly; stale locks (dead PID on the same host, or age > 60 seconds) are evicted automatically; `SIGINT`/`SIGTERM`/normal exit release the lock idempotently. Dry-run and check-only modes skip the lock. Watch mode's lock-file ignore list was extended so self-triggered generate passes do not retrigger the watcher.
- **Cross-platform CI matrix** — quality gates now run on `ubuntu-latest` × Node 20/22/24, plus `windows-latest` × Node 22 and `macos-latest` × Node 22. Previously only `ubuntu-latest` × Node 22. E2E tests run on Linux and macOS; Windows runs lint/typecheck/unit/build.
- **Packaging guards in CI** — three new gates run on every push in a dedicated `smoke` job:
  - `publint` — package.json metadata sanity (exports ordering, `files`, module type).
  - `@arethetypeswrong/cli` with the `esm-only` profile — verifies every public entrypoint resolves to types under `node16 (from ESM)` and `bundler` module resolution.
  - `tests/consumer-smoke/` — packs the tarball, installs it into a throwaway strict-mode TS project, and runs `tsc --noEmit` against every public symbol (runtime functions, canonical types, target-descriptor types, and error classes). Catches `TS7016` and type-resolution regressions that packaging-metadata checks miss.
  - Also runnable locally via `pnpm publint`, `pnpm attw`, `pnpm consumer-smoke`.
- **Post-pack smoke test in CI** — the `smoke` job installs the packed tarball with `npm install -g` and verifies `agentsmesh --version`, `agentsmesh --help`, `amsh --version`, and `agentsmesh init --yes` all succeed in a clean temp project. Catches broken shebangs, missing files from the `files` array, and bin misconfiguration before publish.
- **`docs/add-new-target-playbook.md`** — self-contained guide for adding a new target (built-in or external plugin, project and global mode) designed to be handed to an AI coding agent. Covers research checklist, scaffold workflow, descriptor filling, realistic fixtures, strict-assertion test patterns, registration file wiring, matrix/docs updates, and a verification one-liner. Referenced by the canonical `add-agent-target` skill as the authoritative workflow document.
- **Boot-time guard against ambiguous shared-artifact ownership** — `BUILTIN_TARGETS` initialization now runs `assertSharedArtifactOwnersUnique()` (`src/targets/catalog/shared-artifact-owner.ts`) and throws if two descriptors claim the same or overlapping `sharedArtifacts: { '<prefix>': 'owner' }` entry. Previously the rewriter would silently pick the first match by iteration order, so a misconfigured plugin or future builtin could quietly route global skill writes to the wrong target. The error names both target IDs and both prefixes and suggests changing one role to `'consumer'` or namespacing the prefix. Covered by `tests/unit/targets/catalog/shared-artifact-owner.test.ts` (9 cases including identical-prefix conflicts, prefix-overlap conflicts, owner-vs-consumer non-conflicts, and the live builtin set).
- **Cross-process race coverage for the generate lock** — `tests/integration/generate-process-lock.integration.test.ts` now proves two parallel `node dist/cli.js generate` invocations against the same project serialize via the existing process lock, both exit `0`, produce deterministic output, and release `.agentsmesh/.generate.lock` after the run. Complements the existing unit tests that exercise `acquireProcessLock` directly.
- **End-to-end Copilot dual-mirror coverage** — `tests/unit/targets/copilot/global-layout.test.ts` adds two engine-level assertions that prove Copilot's `mirrorGlobalPath` emits the exact set `.copilot/skills/<name>/`, `.agents/skills/<name>/`, and `.claude/skills/<name>/` in global mode when codex-cli is not active, and skips the `.agents/skills/` mirror when codex-cli is generated alongside (so codex-cli's `'owner'` claim wins).
- **Programmatic API: complete `lint`, `diff`, `check`, and config-loader surface** — every CLI capability is now callable as a typed function. New exports from `agentsmesh` and `agentsmesh/engine`:
  - `loadConfig(projectRoot)` and `loadConfigFromDirectory(configDir)` — load + validate `agentsmesh.yaml` (merging `agentsmesh.local.yaml`) and return `{ config: ValidatedConfig, configDir }`. Throws `ConfigNotFoundError` / `ConfigValidationError` with stable `code` fields.
  - `loadProjectContext(projectRoot, options?)` — loads the same execution context the CLI uses: scoped config, plugin descriptors, `extends`, packs, and local canonical content. The returned object is directly usable with `generate`, `lint`, and `diff`.
  - `lint(opts)` — runs target linters, returns `{ diagnostics, hasErrors }`. Pure: no I/O, no logging.
  - `diff(ctx)` — runs generate internally, returns `{ results, diffs, summary }`. Plus `computeDiff(results)` and `formatDiffSummary(summary)` helpers for callers that already have generate results.
  - `check(opts)` — pure lock-vs-current drift detection backed by the new shared `src/core/check/lock-sync.ts` module. Returns a structured `LockSyncReport` (`inSync`, `hasLock`, `modified`, `added`, `removed`, `extendsModified`, `lockedViolations`). The `agentsmesh check` CLI command was refactored to use the same helper so CLI and Programmatic API can never drift.
  - New types: `ValidatedConfig`, `TargetLayoutScope`, `LintOptions`, `LintResult`, `LintDiagnostic`, `ComputeDiffResult`, `DiffEntry`, `DiffSummary`, `CheckLockSyncOptions`, `LockSyncReport`.
- **Programmatic API runtime coverage** — new `tests/integration/programmatic-api.integration.test.ts` (26 strict assertions) exercises every public function and every error class against real fixture state: shape inventory, `loadConfig` happy/missing/invalid-schema paths, `loadCanonical`, `loadProjectContext` CLI-parity loading, `generate` with exact-paths assertion, `targetFilter` narrowing, `registerTargetDescriptor` plugin wiring through `generate`, plugin `importFrom` end-to-end, `lint` shape, `diff` + `computeDiff` summary parity, `check` for `hasLock=false` / `inSync=true` / modified-drift, immutable catalog inspection, `resolveOutputCollisions`. Replaces the previous shallow `public-export-smoke.integration.test.ts` (which only checked `typeof === 'function'` and used loose `length > 0` assertions).
- **Programmatic API type contract coverage** — `tests/consumer-smoke/src/smoke.ts` extended to import every new symbol (`loadProjectContext`, `loadConfig`, `loadConfigFromDirectory`, `loadCanonical`, `loadCanonicalFiles`, `lint`, `diff`, `check`, `computeDiff`, `formatDiffSummary`, `ProjectContext`, `LoadProjectContextOptions`, `LoadCanonicalOptions`, `ValidatedConfig`, `LintOptions`, `LintResult`, `CheckLockSyncOptions`, `LockSyncReport`, `ComputeDiffResult`, `DiffEntry`, `DiffSummary`) and exercise them with no `unknown` casts (the previous `as unknown as ValidatedConfig` hack is gone now that the type is public). `pnpm consumer-smoke` packs the tarball, installs into a strict-mode TS project, and `tsc --noEmit`s the full surface — catches `TS7016` and signature regressions before publish.
- **Dedicated Programmatic API reference page** at `website/src/content/docs/reference/programmatic-api.mdx` — entrypoint table, the recommended `loadProjectContext` generate pattern, per-function signatures and examples for `loadProjectContext` / `loadConfig` / `loadCanonical` / `generate` / `importFrom` / `lint` / `diff` / `check` / `registerTargetDescriptor` / catalog inspection, full error taxonomy table, canonical types, target-descriptor types, and stability guarantees. Linked from the landing page and sidebar Reference section. README "Programmatic API" section rewritten so the example actually compiles and matches CLI setup for plugins, `extends`, and packs.

### Changed

- **Production-grade build output** — `tsup.config.ts` reworked with a split policy that matches the two artifact families:
  - **CLI binary (`dist/cli.js`)**: minified with `keepNames: true` so stack traces still reference real function/class names. Sourcemap no longer shipped to npm — with `keepNames` the minified stack traces remain debuggable from error text alone, and the 1.6 MB sourcemap was dead weight for the 99% of users who never debug into CLI internals (maintainers reproduce locally with sourcemap on).
  - **Library entries (`dist/{index,engine,canonical,targets}.js`)**: unminified (consumers' bundlers minify their own output — standard convention used by React, Vue, Vitest, tsup itself), sourcemaps shipped (consumers stepping into library code from their own debugger get a usable experience).
  - Explicit `treeshake: true` on both bundle families.
  - Net effect: `dist/cli.js` 643 KB → 325 KB (-49%); compressed npm tarball 1.21 MB → 923 KB (-24%); unpacked install 6.0 MB → 4.75 MB (-21%). CLI cold-start parse time drops correspondingly.
- **Conversion config schema**: inner `commands_to_skills` and `agents_to_skills` objects changed from `.strict()` to `.passthrough()`, allowing plugin target IDs without validation errors. The outer `conversions` object remains strict. Conversion values now accept either `boolean` (both scopes) or `{ project?: boolean, global?: boolean }` for per-scope control.
- **Conversion helpers**: `shouldConvertCommandsToSkills` and `shouldConvertAgentsToSkills` accept optional `defaultEnabled` and `scope` parameters. Per-scope config values are resolved against the active scope, with missing scope keys falling back to builtin defaults.
- **Builtin-targets module**: five lookup functions (`getTargetCapabilities`, `getTargetDetectionPaths`, `getTargetLayout`, `getEffectiveTargetSupportLevel`, `resolveTargetFeatureGenerator`) now fall back to the plugin registry via `getDescriptor()` when no builtin match is found.
- **Registry**: `builtinDescriptors` map is now lazily initialized to avoid circular-dependency crashes between `builtin-targets.ts` and `registry.ts`.
- **JSON Schema**: `schemas/agentsmesh.json` updated — conversion inner objects now use `"additionalProperties": {}` (passthrough) instead of `"additionalProperties": false`.
- **`agentsmesh generate --global` log output** — generated file paths now display with a `~/` prefix (e.g. `✓ updated ~/.claude/settings.json`) so users cannot mistake a home-directory write for a project-local write. Applies to dry-run, check-only, and success output. Project-mode display is unchanged.
- **`writeFileAtomic` safety hardening** — orphaned `.tmp` sidecars are now removed on rename failure. Target paths that already exist as directories throw `FileSystemError` with `errnoCode: 'EISDIR'` instead of leaking the raw rename error. Readable error messages preserved with original errors as `cause`.
- **Remote tar extraction hardening** — `tar.extract` for GitHub tarballs now runs with `strict: true` (promotes warnings to errors) and explicitly rejects `Link` and `SymbolicLink` entries in addition to the existing zip-slip `..` / absolute-path filter. Defense-in-depth against malicious remote packs.
- **Package metadata**: `main` and `types` point at `./dist/index.{js,d.ts}`; root `exports."."` is a full conditional block. `@arethetypeswrong/cli` and `publint` added as devDependencies. New npm scripts: `publint`, `attw`, `consumer-smoke`.
- **README**: new **Programmatic API** section with typed import examples for the root barrel and the three subpath entrypoints (`agentsmesh/engine`, `agentsmesh/canonical`, `agentsmesh/targets`).
- **`--global` commands now throw a scope-aware error when `~/.agentsmesh/agentsmesh.yaml` is missing.** The message points at the exact missing path and suggests `agentsmesh init --global` to create the global canonical root, or dropping `--global` to operate on the current project. Applies uniformly to `generate`, `import`, `lint`, `check`, `diff`, `watch`, and `matrix`. Previously a generic "config not found" error left first-time global users guessing. Covered by `tests/unit/config/scope.test.ts`.
- **`ConfigNotFoundError` constructor accepts an optional `message` override** (`{ cause?, message? }`) so wrappers can supply scope-aware copy without losing the typed error class, `code`, or `path`. Existing callers that pass only `path` (and optional `cause`) are unchanged.

### Removed

- **Native Windows support deferred to a later release.** `package.json` now declares `"os": ["darwin", "linux"]`, the CI matrix dropped `windows-latest`, and the README's Install section calls this out with WSL2 as a workaround. The deferral path and re-enablement checklist are tracked in `docs/roadmap.md` under "Windows support (deferred)". Three POSIX-correctness fixes that landed in this release as defense-in-depth — `installs.yaml` `source` field always written as POSIX (`src/install/source/parse-install-local.ts`), plugin file-URL conversion via `fileURLToPath` instead of `URL.pathname` (`src/plugins/load-plugin.ts`), and `path.join` used in the canonical extend-load test expectations — already pave the way for the eventual re-enablement.

### Fixed

- **Programmatic API parity gaps** — `loadCanonical()` now mirrors CLI canonical loading by merging `extends` and packs when config is available (`loadCanonicalFiles()` remains the local-only helper); public `importFrom()` now resolves registered plugin descriptors as well as built-ins; plugin `buildImportPaths()` hooks now participate in shared import reference normalization; `getTargetCatalog()` returns immutable catalog snapshots instead of the live built-in array; descriptor registration now rejects non-`none` capabilities that do not have a generator or settings sidecar emitter.
- **`TS7016` on root import** — `import { ... } from 'agentsmesh'` previously resolved to `./dist/cli.js`, which was built with `dts: false`. Root exports now point at the typed library barrel, and `attw` + `publint` + consumer-smoke guards prevent regression.
- **Stale coverage exclusion paths in `vitest.config.ts`** — 15 excluded files referenced stale paths after a folder restructure (`src/utils/fs.ts` → `src/utils/filesystem/fs.ts`, `src/config/lock.ts` → `src/config/core/lock.ts`, `src/install/git-pin.ts` → `src/install/source/git-pin.ts`, and others). Paths corrected; one entry for a deleted file (`src/install/local-source.ts`) removed.
- **Canonical `add-agent-target` skill** — restored mangled prose references (`` `../../` `` back to `` `.agentsmesh/` ``); updated stale code touchpoints (`src/config/schema.ts` → `src/config/core/schema.ts`, `src/cli/help.ts` → `src/cli/help-data.ts`, `src/core/matrix/matrix.ts` → `src/core/matrix/data.ts`); added missing registration-file pointers (`target-ids.ts`, `builtin-targets.ts`, `import-maps/index.ts`); named the `agentsmesh target scaffold <id>` scaffold command as the starting step; referenced `docs/add-new-target-playbook.md` for the step-by-step workflow; added `pnpm matrix:verify`, `pnpm publint`, `pnpm attw`, and `pnpm consumer-smoke` to the required verification list.

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
