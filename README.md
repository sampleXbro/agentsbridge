<div align="center">

# AgentsMesh — One AI Coding Config for Every Tool

[![CI](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsmesh/branch/master/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsmesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/agentsmesh.svg)](https://nodejs.org/)
[![npm downloads](https://img.shields.io/npm/dm/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Docs](https://img.shields.io/badge/docs-website-brightgreen.svg)](https://samplexbro.github.io/agentsmesh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/sampleXbro/agentsmesh/pulls)

**One canonical `.agentsmesh/` directory replaces scattered rules, prompts, agents, skills, MCP servers, hooks, ignore files, and permissions across every major AI coding tool.**

Edit once — generate `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`, `.gemini/settings.json`, `.windsurf/rules`, `.codex/config.toml`, `.kiro/steering`, and more from the same source. Bidirectional import so you can adopt it on existing projects with one command.

**Works with** Claude Code · Cursor · GitHub Copilot · Gemini CLI · Windsurf · Continue · Cline · Kiro · Codex CLI · Junie · Roo Code · Antigravity — and new tools as the ecosystem grows. See the [full feature matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/).

</div>

> **Full documentation: [samplexbro.github.io/agentsmesh](https://samplexbro.github.io/agentsmesh)**

---

## Why AgentsMesh

- **One source of truth** — edit `.agentsmesh/`, generate everywhere. No more copy-pasting rules between tool directories.
- **Bidirectional sync** — import existing configs into canonical form and generate back out. Lossless round-trip, no manual reformatting.
- **Project + Global modes** — sync team config via project-local `.agentsmesh/` *and* personal config via user-level `~/.agentsmesh/`.
- **Plugin system** — add support for any AI coding tool via an npm package. No fork, no core PR.
- **Team-safe collaboration** — lock files track generated state, `check` catches drift in CI, `merge` resolves conflicts after `git merge`.
- **Community packs** — install shared skills, rules, agents, and commands from GitHub / GitLab / git URLs.
- **Growing tool coverage** — new AI coding tools are added as the ecosystem evolves. See the [matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/).

---

## Install

Requires **Node.js 20+**. Supported platforms: **Linux** and **macOS**. Native Windows support is deferred — track [the Windows support roadmap entry](docs/roadmap.md) for status. WSL2 works as a workaround.

```bash
npm install -D agentsmesh       # or: pnpm add -D / yarn add -D
npx agentsmesh --help           # run without installing
```

CLI aliases: `agentsmesh` and `amsh`.

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

## Features

### One config, every AI coding tool

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

### Global mode — personal setup, same workflow

`.agentsmesh/` at the project level is for teams. `~/.agentsmesh/` at the home level is for personal setup across every repo you touch:

```bash
agentsmesh init --global
agentsmesh import --global --from claude-code
agentsmesh generate --global   # writes ~/.claude/CLAUDE.md, ~/.cursor/, ~/.codex/, ~/.windsurf/, etc.
```

Every built-in target and every plugin supports global mode. Every CLI command (`diff`, `lint`, `watch`, `check`, `merge`, `matrix`) accepts `--global`. [Global mode paths per tool →](https://samplexbro.github.io/agentsmesh/reference/supported-tools/#global-mode)

### Plugins — add any AI tool

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
- **`agentsmesh merge`** — recover from three-way `.lock` conflicts after `git merge`
- **Collaboration config** — `lock_features` and `strategy` prevent accidental overrides

### Community packs

Install shared skills, rules, agents, and commands from any git repo:

```bash
agentsmesh install github:org/shared-config@v1.0.0
agentsmesh install --path rules --as rules github:team/standards
agentsmesh install --sync       # restore all packs after clone
```

Packs live in `.agentsmesh/packs/`, track in `installs.yaml`, and merge into canonical config on every `generate`.

### Extending AgentsMesh

- **`agentsmesh target scaffold foo-ide`** — generate a built-in target skeleton (10 files, ready to contribute upstream) with global mode, conversion support, and lint hooks pre-wired
- **`agentsmesh plugin add <pkg>`** — load third-party npm packages as runtime targets with full built-in parity

[Extending guide →](https://samplexbro.github.io/agentsmesh/guides/extending/) · [Building plugins →](https://samplexbro.github.io/agentsmesh/guides/building-plugins/)

---

## Supported tools — feature matrix

### Project scope (`agentsmesh generate`)

<!-- agentsmesh:support-matrix:project -->
| Feature | Claude Code | Cursor | Copilot | Continue | Junie | Kiro | Gemini CLI | Cline | Codex CLI | Windsurf | Antigravity | Roo Code |
|---|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|
| Rules | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| Additional Rules | Native | Embedded | Native | Native | Native | Native | Embedded | Native | Native | Native | Native | Native |
| Commands | Native | Native | Native | Embedded | Native | — | Native | Native (workflows) | Embedded | Native (workflows) | Partial (workflows) | Native |
| Agents | Native | Native | Native | — | Native | Native | Native | Embedded | Native | Embedded | — | Partial |
| Skills | Native | Native | Native | Embedded | Native | Native | Native | Native | Native | Native | Native | Native |
| MCP Servers | Native | Native | — | Native | Native | Native | Native | Native | Native | Partial | — | Native |
| Hooks | Native | Native | Partial | — | — | Native | Partial | Native | — | Native | — | — |
| Ignore | Native | Native | — | — | Native | Native | Native (settings-embedded) | Native | — | Native | — | Native |
| Permissions | Native | Partial | — | — | — | — | Partial | — | — | — | — | — |
<!-- /agentsmesh:support-matrix:project -->

### Global scope (`agentsmesh generate --global`)

<!-- agentsmesh:support-matrix:global -->
| Feature | Claude Code | Cursor | Copilot | Continue | Junie | Kiro | Gemini CLI | Cline | Codex CLI | Windsurf | Antigravity | Roo Code |
|---|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|:-----------:|
| Rules | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| Additional Rules | Native | Embedded | Native | Native | Embedded | Native | Embedded | Native | Embedded | Partial | Embedded | Native |
| Commands | Native | Native | Native | Native | Native | — | Native | Native (workflows) | Embedded | Native (workflows) | Partial (workflows) | Native |
| Agents | Native | Native | Native | — | Native | Native | Native | Embedded | Native | Embedded | — | Partial |
| Skills | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native | Native |
| MCP Servers | Native | Native | — | Native | Native | Native | Native | Native | Native | Partial | Native | Native |
| Hooks | Native | Native | — | — | — | — | Partial | Native | — | Native | — | — |
| Ignore | Native | Native | — | — | — | Native | — | Native | — | Native | — | Native |
| Permissions | Native | — | — | — | — | — | — | — | — | — | — | — |
<!-- /agentsmesh:support-matrix:global -->

See the [full feature matrix docs](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for native vs. embedded support details and per-tool global paths.

---

## Programmatic API

AgentsMesh is also importable as a typed ESM library, so you can drive every CLI capability — `generate`, `import`, `lint`, `diff`, `check` — from scripts, IDE extensions, MCP servers, or CI without spawning the CLI. Public entrypoints: `agentsmesh` (full surface), `agentsmesh/engine`, `agentsmesh/canonical`, `agentsmesh/targets`.

```ts
import {
  loadConfig,
  loadCanonical,
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

// Canonical 4-line generate pattern: load config → load canonical → call engine.
const { config } = await loadConfig(process.cwd());
const canonical = await loadCanonical(process.cwd());
const results: GenerateResult[] = await generate({
  config,
  canonical,
  projectRoot: process.cwd(),
  scope: 'project',
});

// Lint — pure, returns structured diagnostics + hasErrors.
const lintResult: LintResult = await lint({ config, canonical, projectRoot: process.cwd() });

// Diff — runs generate internally, returns unified diffs + summary.
const { diffs, summary } = await diff({ config, canonical, projectRoot: process.cwd() });

// Check — lock-file vs current canonical drift report.
const drift: LockSyncReport = await check({
  config,
  configDir: process.cwd(),
  canonicalDir: `${process.cwd()}/.agentsmesh`,
});

// Import a tool's native config back into canonical form (writes to disk).
await importFrom('claude-code', { root: process.cwd() });

// Register a custom target descriptor at runtime (same shape plugins ship).
const myDescriptor: TargetDescriptor = /* ... */;
registerTargetDescriptor(myDescriptor);
```

Subpath imports are available when you want narrower bundles:

```ts
import { generate, lint, diff, check, loadConfig } from 'agentsmesh/engine';
import { loadCanonical } from 'agentsmesh/canonical';
import { getAllDescriptors } from 'agentsmesh/targets';
```

Every public symbol resolves to a real `.d.ts` under strict TypeScript. Full reference at [agentsmesh.dev/reference/programmatic-api](https://samplexbro.github.io/agentsmesh/reference/programmatic-api/) — entrypoint table, every function signature, the typed error taxonomy, and the canonical/target type lists. ESM-only; requires Node.js 20+.

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
