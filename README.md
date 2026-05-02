<div align="center">

# AgentsMesh — One `.agentsmesh/` Directory for Every AI Coding Tool

<img src="https://raw.githubusercontent.com/sampleXbro/agentsmesh/master/assets/agentsmesh-banner.jpeg" alt="AgentsMesh — One source. Every AI coding tool. Always in sync." width="100%" />

[![CI](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsmesh/branch/master/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsmesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/agentsmesh.svg)](https://nodejs.org/)
[![npm downloads](https://img.shields.io/npm/dm/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Docs](https://img.shields.io/badge/docs-website-brightgreen.svg)](https://samplexbro.github.io/agentsmesh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/sampleXbro/agentsmesh/pulls)

</div>

AI coding assistants now ship with their own configuration formats — `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.gemini/settings.json`, `.windsurf/rules/*.md`, `.codex/config.toml`, `.kiro/steering/*.md`, and more. Maintaining the same rules, prompts, MCP servers, hooks, and permissions across all of them by hand causes config drift fast.

**AgentsMesh** is an open-source CLI and TypeScript library that fixes this. You write canonical rules, commands, agents, skills, MCP, hooks, ignore files, and permissions once in `.agentsmesh/`, then `agentsmesh generate` projects them out as native config for every supported assistant. `agentsmesh import` brings existing tool configs back into canonical form, and `agentsmesh check` catches drift in CI.

> **Full documentation: [samplexbro.github.io/agentsmesh](https://samplexbro.github.io/agentsmesh)**

---

## Before / After

**Before — fragmented assistant-native config in one repo:**

```text
CLAUDE.md
AGENTS.md
.cursor/rules/*.mdc
.github/copilot-instructions.md
.gemini/settings.json
.windsurf/rules/*.md
.codex/config.toml
.kiro/steering/*.md
```

**After — one canonical source, generated everywhere:**

```text
.agentsmesh/
  rules/
    _root.md
  commands/
  agents/
  skills/
  mcp.json
  hooks.yaml
  permissions.yaml
  ignore
```

```bash
npx agentsmesh generate
```

The native files above are still emitted — AgentsMesh writes them for you from `.agentsmesh/`. Edit canonical sources, regenerate, and every tool stays in sync.

---

## 60-second quickstart

Requires Node.js 20+. Works on Linux, macOS, and Windows (native, not WSL).

```bash
npx agentsmesh init       # scaffold .agentsmesh/ + agentsmesh.yaml
npx agentsmesh generate   # produce native configs for every enabled tool
npx agentsmesh check      # CI-friendly drift gate against .agentsmesh/.lock
```

- **`init`** — creates `agentsmesh.yaml`, `agentsmesh.local.yaml`, and the canonical `.agentsmesh/` directory.
- **`generate`** — writes `CLAUDE.md`, `AGENTS.md`, `.cursor/`, `.github/copilot-instructions.md`, etc. from canonical sources.
- **`check`** — exits non-zero if generated files have drifted from `.agentsmesh/.lock`. Drop into CI.

Prefer a local install? `npm install -D agentsmesh` (also `pnpm add -D` / `yarn add -D`). The CLI ships as `agentsmesh` and the shorter alias `amsh`.

---

## Safe adoption in an existing repository

If your repo already has `.cursor/`, `.claude/`, `.github/copilot-instructions.md`, or other native files, you don't have to delete them. The recommended flow imports them into `.agentsmesh/` first, lets you preview the projection, and only then trusts `generate`.

```bash
npx agentsmesh import --from cursor   # or claude-code, copilot, codex-cli, gemini-cli, windsurf, ...
npx agentsmesh diff                   # patch-style preview of what generate would change
npx agentsmesh generate               # write native configs (back) from canonical
npx agentsmesh check                  # add to CI to detect drift
```

What this gets you:

- `import` reads existing tool configs and writes equivalent canonical files into `.agentsmesh/` — round-trip metadata is preserved so re-import doesn't lose information.
- `diff` shows the unified patch every output file would receive, so you can review before any write.
- `check` reads `.agentsmesh/.lock` and fails the build if the canonical sources and the generated files disagree.

`import --from` accepts the built-in target IDs: `claude-code`, `cursor`, `copilot`, `codex-cli`, `gemini-cli`, `windsurf`, `continue`, `cline`, `kiro`, `kilo-code`, `junie`, `roo-code`, `antigravity`. Plugin targets are valid too.

---

## Demo

<!-- TODO: Add terminal demo GIF showing init → generate → diff → check. -->

A quick sample of the canonical → native projection:

```bash
npx agentsmesh init
find .agentsmesh -maxdepth 2 -type f      # see the canonical scaffold
npx agentsmesh generate
npx agentsmesh diff                       # preview future changes
npx agentsmesh check                      # CI-style drift gate
```

On macOS/Linux you can also run `tree .agentsmesh` if you have `tree` installed.

---

## Supported AI coding tools

AgentsMesh currently generates native config for every major AI coding assistant — Claude Code, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Continue, Cline, Kiro, Codex CLI, Junie, Roo Code, Antigravity — plus plugin targets you can ship as standalone npm packages. Each tool's native vs. embedded support per feature is tracked in the [supported tools matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/). The full matrix table is also embedded [further down this README](#supported-tools--feature-matrix).

---

## Why developers use AgentsMesh

- **Bidirectional sync** — `import` reads existing tool configs into `.agentsmesh/`; `generate` projects them back out. Round-trips are loss-free, so adopting AgentsMesh in an existing repo never throws away data.
- **Automatic link rebasing** — references like `.agentsmesh/skills/foo/SKILL.md` are rewritten to target-relative paths in every generated artifact, so cross-file links stay valid from `.claude/`, `.cursor/`, `.github/`, `.codex/`, and the rest.
- **Managed embedding with round-trip metadata** — when a target has no native slot for a feature (e.g. commands in Codex CLI, agents in Cline), AgentsMesh embeds it with frontmatter that survives the next `import`. No silent data loss; the full feature-by-feature breakdown lives in the [supported tools matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/).
- **Team-safe collaboration** — `agentsmesh check` is a CI drift gate against `.agentsmesh/.lock`, `agentsmesh diff` previews changes, `agentsmesh merge` rebuilds the lock after three-way Git conflicts, and `lock_features` + per-feature `strategy` prevent accidental overrides.
- **Global mode** — `~/.agentsmesh/` syncs personal AI config to `~/.claude/`, `~/.cursor/`, `~/.codex/`, `~/.windsurf/`, and other user-level folders. Every CLI command accepts `--global`.
- **Extensible** — community packs (`agentsmesh install ...`), remote `extends`, runtime plugins (`agentsmesh plugin add`), schema-validated config files, and a typed programmatic API for scripts, IDE extensions, and CI.

---

## Why not just `AGENTS.md`?

[`AGENTS.md`](https://agents.md) is great as a shared, human-readable instruction file. AgentsMesh uses `AGENTS.md` natively where the target supports it (Codex CLI, Cursor, Copilot, Junie, Windsurf, …) and treats it as a first-class output, not a competitor.

The reason `AGENTS.md` alone is not enough: most AI coding assistants expose configuration surfaces beyond a single instruction markdown file, and those surfaces don't all overlap.

- **Cursor** has `.cursor/rules/*.mdc` (with frontmatter scopes), `.cursorignore`, MCP config, and hooks.
- **Claude Code** has `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/settings.json`, hooks, and permissions.
- **GitHub Copilot** has `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, agents, prompts, and (partial) hooks.
- **Gemini CLI** has `GEMINI.md`, `.gemini/settings.json` (MCP + hooks), `.gemini/commands/*.toml`, and agents.
- **Codex CLI** has `AGENTS.md` plus `.codex/config.toml`, `.codex/agents/*.toml`, and `.codex/rules/`.
- **Windsurf**, **Continue**, **Cline**, **Kiro**, **Junie**, **Roo Code**, **Antigravity** each have their own native rules, workflows, MCP servers, skills, and ignore files.

AgentsMesh canonicalizes all of these — rules, commands, agents, skills, MCP servers, hooks, ignore patterns, permissions — so you don't pick one tool's surface as the lowest common denominator. When a tool has no native slot for a feature, AgentsMesh embeds it with round-trip metadata instead of dropping it.

---

## Core concepts

`.agentsmesh/` is the canonical source of truth. Generated tool files are artifacts. The directory contains:

- `rules/_root.md` — the root rule every target projects (typically becomes `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/_root.mdc`, etc.).
- `rules/*.md` — additional scoped rules.
- `commands/*.md` — reusable slash-style prompts/commands.
- `agents/*.md` — agent definitions (where the target supports them).
- `skills/<name>/SKILL.md` (+ supporting files) — composable skills.
- `mcp.json` — MCP server definitions.
- `hooks.yaml` — pre/post tool hooks.
- `permissions.yaml` — allow/deny rules where the target supports them.
- `ignore` — paths the assistant should not read or modify.

Configuration:

- `agentsmesh.yaml` — selects which targets and features are enabled.
- `agentsmesh.local.yaml` — per-developer overrides (gitignored by default).
- `.agentsmesh/.lock` — drift-detection lock file consumed by `agentsmesh check`.

Detailed contracts: [Canonical Config](https://samplexbro.github.io/agentsmesh/canonical-config/) · [Generation pipeline](https://samplexbro.github.io/agentsmesh/reference/generation-pipeline/).

---

## CLI usage

```bash
agentsmesh init [--global] [--yes]
agentsmesh generate [--global] [--targets <csv>] [--check] [--dry-run] [--force] [--refresh-cache]
agentsmesh import --from <target> [--global]
agentsmesh diff [--global] [--targets <csv>]
agentsmesh lint [--global] [--targets <csv>]
agentsmesh watch [--global] [--targets <csv>]
agentsmesh check [--global]
agentsmesh merge [--global]
agentsmesh matrix [--global] [--targets <csv>] [--verbose]
agentsmesh install <source> [--sync] [--path <dir>] [--target <id>] [--as <kind>] [--name <id>] [--extends] [--dry-run] [--global] [--force]
agentsmesh plugin add|list|remove|info [--version <v>] [--id <id>]
agentsmesh target scaffold <id> [--name <displayName>] [--force]
```

`agentsmesh --help` prints the same surface; `agentsmesh <cmd> --help` is also supported.

### Global mode (personal AI assistant config)

`.agentsmesh/` at the project level is for teams. `~/.agentsmesh/` at the home level is for personal setup across every repo you touch:

```bash
agentsmesh init --global
agentsmesh import --global --from claude-code
agentsmesh generate --global   # writes ~/.claude/CLAUDE.md, ~/.cursor/, ~/.codex/, ~/.windsurf/, etc.
```

Every built-in target with a global layout supports global mode. Every CLI command (`diff`, `lint`, `watch`, `check`, `merge`, `matrix`) accepts `--global`. [Global mode paths per tool →](https://samplexbro.github.io/agentsmesh/reference/supported-tools/#global-mode)

### Plugins for new AI coding tools

Ship new target support as a standalone npm package — no fork, no core PR:

```bash
agentsmesh plugin add agentsmesh-target-my-tool
agentsmesh generate            # plugin targets run alongside built-ins
agentsmesh generate --global   # global mode works for plugins too
```

Plugins have full parity with built-in targets: project + global layouts, feature conversions, scoped settings, per-feature lint hooks, and hook post-processing. [Build a plugin →](https://samplexbro.github.io/agentsmesh/guides/building-plugins/)

### Team-safe collaboration & CI drift detection

- **`agentsmesh check`** — CI gate that exits 1 if generated files drifted from the lock.
- **`agentsmesh diff`** — preview what the next `generate` would change.
- **`agentsmesh lint`** — validate canonical config against target-specific constraints; also surfaces cross-target warnings (`silent-drop-guard`, `hook-script-references`, `rule-scope-inversion`) for content a target would silently drop or mishandle. [Lint reference →](https://samplexbro.github.io/agentsmesh/cli/lint/)
- **`agentsmesh watch`** — regenerate target files on save during local editing.
- **`agentsmesh merge`** — recover from three-way `.lock` conflicts after `git merge`.
- **Collaboration config** — `lock_features` and `strategy` prevent accidental overrides.

### Community packs and shared config

Install shared skills, rules, agents, and commands from any git repo:

```bash
agentsmesh install github:org/shared-config@v1.0.0
agentsmesh install --path rules --as rules github:team/standards
agentsmesh install --sync       # restore all packs after clone
```

Packs live in `.agentsmesh/packs/`, track in `installs.yaml`, and merge into canonical config on every `generate`.

### What to commit and what to gitignore

`agentsmesh init` writes a `.gitignore` that follows the recommended convention. The defaults are deliberate:

| Path | In git? | Why |
|---|---|---|
| `.agentsmesh/` (canonical) | **commit** | The source of truth — must be in git. |
| `.agentsmesh/.lock` | **commit** | Drift detection contract. `agentsmesh check` compares against this. |
| `.agentsmesh/packs/` | **gitignore** | Materialized from `installs.yaml`. Same model as `node_modules` — `agentsmesh install --sync` reproduces them deterministically post-clone. |
| `agentsmesh.local.yaml` | **gitignore** | Per-developer overrides. |
| `.agentsmesh/.lock.tmp` | **gitignore** | Transient. |
| `.agentsmeshcache` | **gitignore** | Remote-extends cache. |
| Generated tool folders (`.claude/`, `.cursor/`, `.github/`, `.gemini/`, `CLAUDE.md`, `AGENTS.md`, etc.) | **commit** | AI tools read these at runtime. Committing means a fresh clone has working AI configs without a build step. `agentsmesh check` in CI catches drift between canonical and generated. |

Why generated configs stay committed: the same reason `package-lock.json` does. They're deterministic build output that downstream consumers (in this case, the AI tool itself) read directly. Gitignoring them breaks fresh-clone UX and makes `agentsmesh check` meaningless. PR reviewers also benefit from seeing the projected diff in the format Claude/Cursor/Copilot will actually consume.

If your team has a strong reason to gitignore generated configs (e.g., monorepo size concerns, regenerate-on-checkout hooks), add the target-specific entries manually — but expect to wire `agentsmesh generate` into your post-checkout flow.

### Schema-validated configs (IDE autocomplete)

Every config file ships with a generated JSON Schema, so VS Code, JetBrains, and other editors give you autocomplete and validation out of the box:

| Config file | JSON Schema |
|---|---|
| `agentsmesh.yaml` / `.local.yaml` | `node_modules/agentsmesh/schemas/agentsmesh.json` |
| `.agentsmesh/hooks.yaml` | `schemas/hooks.json` |
| `.agentsmesh/permissions.yaml` | `schemas/permissions.json` |
| `.agentsmesh/mcp.json` | `schemas/mcp.json` |
| `.agentsmesh/packs/*/pack.json` | `schemas/pack.json` |

`agentsmesh init` writes the appropriate `# yaml-language-server: $schema=...` directive (or `$schema` field for JSON) into each canonical file, so editors pick up validation immediately.

---

## TypeScript / Programmatic API

AgentsMesh is also importable as a typed ESM library, so you can drive every CLI capability — `generate`, `import`, `lint`, `diff`, `check` — from scripts, IDE extensions, MCP servers, or CI without spawning the CLI. Public entrypoints: `agentsmesh` (full surface), `agentsmesh/engine`, `agentsmesh/canonical`, `agentsmesh/targets`.

`loadProjectContext()` mirrors what the CLI does on startup: resolves config, applies local overrides, loads plugins, materializes `extends` and installed packs, and reads the canonical directory. The result is a single context value you can pass to `generate`, `lint`, or `diff` — the same surface the CLI uses.

```ts
import {
  loadProjectContext,
  generate,
  lint,
  diff,
  check,
  importFrom,
  registerTargetDescriptor,
  type GenerateResult,
  type LintResult,
  type LockSyncReport,
  type TargetDescriptor,
} from 'agentsmesh';

// CLI-parity generate pattern: config, plugins, extends, packs, then generation.
const project = await loadProjectContext(process.cwd());
const results: GenerateResult[] = await generate(project);

// Lint — pure, returns structured diagnostics + hasErrors.
const lintResult: LintResult = await lint(project);

// Diff — runs generate internally, returns unified diffs + summary.
const { diffs, summary } = await diff(project);

// Check — lock-file vs current canonical drift report.
const drift: LockSyncReport = await check({
  config: project.config,
  configDir: project.configDir,
  canonicalDir: project.canonicalDir,
});

// Import a built-in or registered plugin target back into canonical form.
await importFrom('claude-code', { root: process.cwd() });

// Register a custom target descriptor at runtime (same shape plugins ship).
const myDescriptor: TargetDescriptor = /* ... */;
registerTargetDescriptor(myDescriptor);
```

Subpath imports are available when you want narrower bundles:

```ts
import { generate, lint, diff, check, loadProjectContext } from 'agentsmesh/engine';
import { loadCanonical, loadCanonicalFiles } from 'agentsmesh/canonical';
import { getAllDescriptors } from 'agentsmesh/targets';
```

Every public symbol resolves to a real `.d.ts` under strict TypeScript. Full reference in the [programmatic API docs](https://samplexbro.github.io/agentsmesh/reference/programmatic-api/) — entrypoint table, every function signature, the typed error taxonomy, and the canonical/target type lists. ESM-only; requires Node.js 20+.

---

## Supported tools — feature matrix

### Project scope (`agentsmesh generate`)

<!-- agentsmesh:support-matrix:project -->
| Feature | Antigravity | Claude Code | Cline | Codex CLI | Continue | Copilot | Cursor | Gemini CLI | Junie | Kilo Code | Kiro | Roo Code | Windsurf |
|---|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|
| Rules | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| Additional Rules | Native | Native | Native | Native | Native | Native | Embedded | Embedded | Native | Native | Native | Native | Native |
| Commands | Partial (workflows) | Native | Native (workflows) | Embedded | Embedded | Native | Native | Native | Native | Native | — | Native | Native (workflows) |
| Agents | — | Native | Embedded | Native | — | Native | Native | Native | Native | Native | Native | Partial | Embedded |
| Skills | Native | Native | Native | Native | Embedded | Native | Native | Native | Native | Native | Native | Native | Native |
| MCP Servers | — | Native | Native | Native | Native | — | Native | Native | Native | Native | Native | Native | Partial |
| Hooks | — | Native | Native | — | — | Partial | Native | Partial | — | — | Native | — | Native |
| Ignore | — | Native | Native | — | — | — | Native | Native (settings-embedded) | Native | Native | Native | Native | Native |
| Permissions | — | Native | — | — | — | — | Partial | Partial | — | — | — | — | — |
<!-- /agentsmesh:support-matrix:project -->

### Global scope (`agentsmesh generate --global`)

<!-- agentsmesh:support-matrix:global -->
| Feature | Antigravity | Claude Code | Cline | Codex CLI | Continue | Copilot | Cursor | Gemini CLI | Junie | Kilo Code | Kiro | Roo Code | Windsurf |
|---|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|
| Rules | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| Additional Rules | Embedded | Native | Native | Embedded | Native | Native | Embedded | Embedded | Embedded | Native | Native | Native | Partial |
| Commands | Partial (workflows) | Native | Native (workflows) | Embedded | Native | Native | Native | Native | Native | Native | — | Native | Native (workflows) |
| Agents | — | Native | Embedded | Native | — | Native | Native | Native | Native | Native | Native | Partial | Embedded |
| Skills | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| MCP Servers | Native | Native | Native | Native | Native | — | Native | Native | Native | Native | Native | Native | Partial |
| Hooks | — | Native | Native | — | — | — | Native | Partial | — | — | — | — | Native |
| Ignore | — | Native | Native | — | — | — | Native | — | — | Native | Native | Native | Native |
| Permissions | — | Native | — | — | — | — | — | — | — | — | — | — | — |
<!-- /agentsmesh:support-matrix:global -->

See the [full feature matrix docs](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for native vs. embedded support details and per-tool global paths.

---

## Documentation

- **[Getting Started](https://samplexbro.github.io/agentsmesh/getting-started/installation/)** — installation, quick start
- **[Canonical Config](https://samplexbro.github.io/agentsmesh/canonical-config/)** — rules, commands, agents, skills, MCP, hooks, ignore, permissions
- **[CLI Reference](https://samplexbro.github.io/agentsmesh/cli/)** — `init`, `generate`, `import`, `install`, `diff`, `lint`, `watch`, `check`, `merge`, `matrix`, `plugin`, `target`
- **[Configuration](https://samplexbro.github.io/agentsmesh/configuration/agentsmesh-yaml/)** — `agentsmesh.yaml`, local overrides, extends, collaboration, conversions
- **[Guides](https://samplexbro.github.io/agentsmesh/guides/existing-project/)** — adopting in existing projects · multi-tool teams · sharing config · CI drift detection · community packs · **building plugins**
- **[Reference](https://samplexbro.github.io/agentsmesh/reference/generation-pipeline/)** — supported tools matrix · generation pipeline · managed embedding

---

## Contributing

Contributions welcome. Keep changes small, test them, and prefer editing canonical `.agentsmesh/` sources over generated files.

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

---

## License

[MIT](LICENSE)
