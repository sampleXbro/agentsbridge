<div align="center">

# AgentsMesh — AI Coding Config Sync for Every Tool

[![CI](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsmesh/branch/master/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsmesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/agentsmesh.svg)](https://nodejs.org/)
[![npm downloads](https://img.shields.io/npm/dm/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Docs](https://img.shields.io/badge/docs-website-brightgreen.svg)](https://samplexbro.github.io/agentsmesh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/sampleXbro/agentsmesh/pulls)

**AgentsMesh is an open-source CLI and TypeScript library for AI coding configuration sync. One canonical `.agentsmesh/` directory manages rules, prompts, commands, agents, skills, MCP servers, hooks, ignore files, and permissions across every major AI coding tool.**

Edit once and generate `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`, `.gemini/settings.json`, `.windsurf/rules`, `.codex/config.toml`, `.kiro/steering`, and more from the same source. Import existing Claude Code, Cursor, Copilot, Gemini CLI, Windsurf, Codex CLI, and other configs back into canonical form without losing round-trip metadata.

**Works with** Claude Code · Cursor · GitHub Copilot · Gemini CLI · Windsurf · Continue · Cline · Kiro · Codex CLI · Junie · Roo Code · Antigravity — plus plugin targets. See the [full feature matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/).

</div>

> **Full documentation: [samplexbro.github.io/agentsmesh](https://samplexbro.github.io/agentsmesh)**

---

## Why developers use AgentsMesh

- **Unify AI coding rules** across Claude Code, Cursor, Copilot, Gemini CLI, Windsurf, Codex CLI, and mixed-tool teams.
- **Adopt existing projects safely** with bidirectional `import` and `generate` instead of rewriting every tool config by hand.
- **Sync personal global config** from `~/.agentsmesh/` to user-level assistant folders such as `~/.claude/`, `~/.cursor/`, and `~/.codex/`.
- **Standardize MCP, hooks, permissions, skills, and agents** where tools support them natively, with metadata-backed projections where they do not.
- **Catch config drift in CI** with lock-file checks, diffs, linting, and merge recovery built for team workflows.
- **Share and extend configuration** with community packs, remote `extends`, runtime plugins, and a typed programmatic API.

---

## Install

Requires **Node.js 20+**. Supported platforms: **Linux**, **macOS**, and **Windows** (native, not WSL).

```bash
npm install -D agentsmesh       # or: pnpm add -D / yarn add -D
npx agentsmesh --help           # run without installing
```

CLI aliases: `agentsmesh` and `amsh`.

> **Windows notes:** All paths are normalized internally so generated configs and `installs.yaml` are portable across platforms. Watch mode uses polling on Windows because `ReadDirectoryChangesW` can miss just-created files in tmpdirs. CI runs the full test suite on Linux, macOS, and Windows.

---

## Quick start

### New project

```bash
agentsmesh init                 # scaffold .agentsmesh/
# edit .agentsmesh/rules/_root.md
agentsmesh generate             # produce configs for every enabled tool
```

### Existing project — adopt with one import

```bash
agentsmesh import --from cursor       # or claude-code, copilot, codex-cli, ...
agentsmesh generate
```

### Personal global config

```bash
agentsmesh init --global
agentsmesh import --global --from claude-code
agentsmesh generate --global          # writes to ~/.claude/, ~/.cursor/, etc.
```

---

## High-demand features

### AI coding config sync for every tool

AgentsMesh generates native configuration for every major AI coding assistant. Each tool's files are produced from a single `.agentsmesh/` directory with support for **rules, commands, agents, skills, MCP servers, hooks, ignore patterns, and permissions**:

| Tool | Main files generated |
|------|---------------------|
| **Claude Code** | `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/settings.json`, `.claude/hooks.json`, MCP via `.claude.json` |
| **Cursor** | `.cursor/rules/*.mdc`, `AGENTS.md`, `.cursor/mcp.json`, `.cursor/hooks.json`, `.cursorignore` |
| **GitHub Copilot** | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `.github/agents/`, `.github/prompts/` |
| **Gemini CLI** | `GEMINI.md`, `.gemini/settings.json` (MCP + hooks), `.gemini/commands/*.toml`, `.gemini/agents/` |
| **Windsurf** | `.windsurf/rules/*.md`, `.windsurf/workflows/`, `.windsurf/mcp_config.json`, `.windsurf/hooks.json` |
| **Continue** | `.continue/rules/`, `.continue/prompts/`, `.continue/mcpServers/`, `.continue/config.yaml` |
| **Cline** | `.clinerules/`, `.cline/skills/`, `.cline/cline_mcp_settings.json`, hooks |
| **Kiro** | `.kiro/steering/`, `.kiro/skills/`, `.kiro/hooks/*.kiro.hook`, `.kiro/settings/mcp.json` |
| **Codex CLI** | `AGENTS.md`, `.codex/config.toml`, `.codex/agents/*.toml`, `.codex/rules/` |
| **Junie** | `AGENTS.md`, `.junie/agents/`, `.junie/commands/`, `.junie/skills/`, `.junie/mcp/mcp.json` |
| **Roo Code** | `.roo/rules/`, `.roomodes` (agents → custom modes), `.roo/commands/`, `.roo/skills/` |
| **Antigravity** | `.agents/rules/general.md`, `.agents/skills/`, `.agents/workflows/`, `.agents/mcp_config.json` |

When a tool lacks native support for a feature, AgentsMesh embeds it with round-trip metadata — no data loss on re-import. See the [supported tools matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for per-tool native vs. embedded breakdown.

### Bidirectional import and lossless generate

Use `agentsmesh import --from <tool>` to migrate existing AI tool configs into canonical `.agentsmesh/` files, then `agentsmesh generate` to project them back out. Managed embedding, reference rewriting, and lock metadata preserve projected features so commands, agents, and skills can round-trip even when a target stores them differently.

### Global mode for personal AI assistant config

`.agentsmesh/` at the project level is for teams. `~/.agentsmesh/` at the home level is for personal setup across every repo you touch:

```bash
agentsmesh init --global
agentsmesh import --global --from claude-code
agentsmesh generate --global   # writes ~/.claude/CLAUDE.md, ~/.cursor/, ~/.codex/, ~/.windsurf/, etc.
```

Every built-in target and every plugin supports global mode. Every CLI command (`diff`, `lint`, `watch`, `check`, `merge`, `matrix`) accepts `--global`. [Global mode paths per tool →](https://samplexbro.github.io/agentsmesh/reference/supported-tools/#global-mode)

### Plugins for new AI coding tools

Ship new target support as a standalone npm package — no fork, no core PR:

```bash
agentsmesh plugin add agentsmesh-target-my-tool
agentsmesh generate            # plugin targets run alongside built-ins
agentsmesh generate --global   # global mode works for plugins too
```

Plugins have full parity with built-in targets: project + global layouts, feature conversions, scoped settings, per-feature lint hooks, and hook post-processing. [Build a plugin →](https://samplexbro.github.io/agentsmesh/guides/building-plugins/)

### Team-safe collaboration & CI drift detection

- **`agentsmesh check`** — CI gate that exits 1 if generated files drifted from the lock
- **`agentsmesh diff`** — preview what the next `generate` would change
- **`agentsmesh lint`** — validate canonical config against target-specific constraints
- **`agentsmesh watch`** — regenerate target files on save during local editing
- **`agentsmesh merge`** — recover from three-way `.lock` conflicts after `git merge`
- **Collaboration config** — `lock_features` and `strategy` prevent accidental overrides

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

### Extending AgentsMesh

- **`agentsmesh target scaffold foo-ide`** — generate a built-in target skeleton (10 files: descriptor, generators, importer, linter, tests, fixtures) with global mode, conversion support, and lint hooks pre-wired. The catalog is auto-discovered at build time (`pnpm catalog:generate`) — no manual edits to `target-ids.ts`, `builtin-targets.ts`, or the import-map barrel.
- **`agentsmesh plugin add <pkg>`** — load third-party npm packages as runtime targets with full built-in parity. Supports `agentsmesh plugin list`, `info`, and `remove`.

[Extending guide →](https://samplexbro.github.io/agentsmesh/guides/extending/) · [Building plugins →](https://samplexbro.github.io/agentsmesh/guides/building-plugins/)

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

## Supported tools — feature matrix

### Project scope (`agentsmesh generate`)

<!-- agentsmesh:support-matrix:project -->
| Feature | Antigravity | Claude Code | Cline | Codex CLI | Continue | Copilot | Cursor | Gemini CLI | Junie | Kiro | Roo Code | Windsurf |
|---|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|
| Rules | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| Additional Rules | Native | Native | Native | Native | Native | Native | Embedded | Embedded | Native | Native | Native | Native |
| Commands | Partial (workflows) | Native | Native (workflows) | Embedded | Embedded | Native | Native | Native | Native | — | Native | Native (workflows) |
| Agents | — | Native | Embedded | Native | — | Native | Native | Native | Native | Native | Partial | Embedded |
| Skills | Native | Native | Native | Native | Embedded | Native | Native | Native | Native | Native | Native | Native |
| MCP Servers | — | Native | Native | Native | Native | — | Native | Native | Native | Native | Native | Partial |
| Hooks | — | Native | Native | — | — | Partial | Native | Partial | — | Native | — | Native |
| Ignore | — | Native | Native | — | — | — | Native | Native (settings-embedded) | Native | Native | Native | Native |
| Permissions | — | Native | — | — | — | — | Partial | Partial | — | — | — | — |
<!-- /agentsmesh:support-matrix:project -->

### Global scope (`agentsmesh generate --global`)

<!-- agentsmesh:support-matrix:global -->
| Feature | Antigravity | Claude Code | Cline | Codex CLI | Continue | Copilot | Cursor | Gemini CLI | Junie | Kiro | Roo Code | Windsurf |
|---|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|
| Rules | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| Additional Rules | Embedded | Native | Native | Embedded | Native | Native | Embedded | Embedded | Embedded | Native | Native | Partial |
| Commands | Partial (workflows) | Native | Native (workflows) | Embedded | Native | Native | Native | Native | Native | — | Native | Native (workflows) |
| Agents | — | Native | Embedded | Native | — | Native | Native | Native | Native | Native | Partial | Embedded |
| Skills | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| MCP Servers | Native | Native | Native | Native | Native | — | Native | Native | Native | Native | Native | Partial |
| Hooks | — | Native | Native | — | — | — | Native | Partial | — | — | — | Native |
| Ignore | — | Native | Native | — | — | — | Native | — | — | Native | Native | Native |
| Permissions | — | Native | — | — | — | — | — | — | — | — | — | — |
<!-- /agentsmesh:support-matrix:global -->

See the [full feature matrix docs](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for native vs. embedded support details and per-tool global paths.

---

## Programmatic API

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
