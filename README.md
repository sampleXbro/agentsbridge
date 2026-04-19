<div align="center">

# AgentsMesh

[![CI](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsmesh/branch/master/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsmesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/agentsmesh.svg)](https://nodejs.org/)
[![npm downloads](https://img.shields.io/npm/dm/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Docs](https://img.shields.io/badge/docs-website-brightgreen.svg)](https://samplexbro.github.io/agentsmesh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/sampleXbro/agentsmesh/pulls)


AgentsMesh maintains a single canonical configuration in `.agentsmesh/` and syncs it bidirectionally to Claude Code, Cursor, Copilot, Continue, Junie, Kiro, Gemini CLI, Cline, Codex CLI, Windsurf, Antigravity, and Roo Code. Rules, commands, agents, skills, MCP servers, hooks, ignore patterns, and permissions -- all from one source of truth.

</div>

> **Full documentation: [samplexbro.github.io/agentsmesh](https://samplexbro.github.io/agentsmesh)**

---

## Why AgentsMesh

- **One source of truth** -- edit `.agentsmesh/`, generate everywhere. No more copy-pasting rules between tool directories.
- **Bidirectional sync** -- import existing configs into canonical form and generate back out. No data loss, no manual reformatting.
- **Team-safe collaboration** -- lock files track generated state, `check` catches drift in CI, `merge` resolves conflicts after `git merge`.
- **Lossless feature projection** -- when a tool lacks native support for a feature, AgentsMesh projects it as an embedded skill with enough metadata to round-trip on re-import.

---

## Installation

Requires **Node.js 20** or later.

```bash
# npm
npm install -D agentsmesh

# pnpm
pnpm add -D agentsmesh

# yarn
yarn add -D agentsmesh

# or run directly
npx agentsmesh --help
```

The CLI is available as both `agentsmesh` and `amsh`.

---

## Quick Start

### New project

```bash
# Scaffold the canonical config directory
agentsmesh init

# Edit your root rule
# vi .agentsmesh/rules/_root.md

# Generate configs for all enabled targets
agentsmesh generate
```

### Existing project with tool configs already in place

```bash
# Import your existing Cursor config (or any supported tool)
agentsmesh import --from cursor

# Generate output for all configured targets
agentsmesh generate
```

### Personal global config (user home)

```bash
# Initialize canonical home config
agentsmesh init --global

# Import a user-level tool setup into ~/.agentsmesh/
agentsmesh import --global --from claude-code
agentsmesh import --global --from antigravity
agentsmesh import --global --from codex-cli
agentsmesh import --global --from cursor

# Install shared packs into ~/.agentsmesh/
agentsmesh install --global github:org/shared-rules

# Work against home-level canonical config
agentsmesh diff --global
agentsmesh lint --global
agentsmesh watch --global
agentsmesh check --global
agentsmesh merge --global
agentsmesh matrix --global
agentsmesh generate --global
```

Global mode uses `~/.agentsmesh/` as the canonical source of truth instead of a project-local `.agentsmesh/`. **All** built-in targets support `--global`; `agentsmesh generate --global` writes user-level outputs for whichever targets are enabled in `agentsmesh.yaml`. Typical paths include:

- **Claude Code** — `~/.claude/CLAUDE.md` (with `# Global Instructions` framing), `~/.claude/settings.json` (permissions), `~/.claude/hooks.json` (hooks), `~/.claude/agents/`, `~/.claude/skills/`, optional mirror to `~/.agents/skills/` when Codex is **not** also a global target (otherwise Codex owns `~/.agents/skills/`), `~/.claude/commands/`, optional `~/.claude/output-styles/` when `outputStyle: true` on an agent or command, `~/.claudeignore`, and `~/.claude.json` for MCP
- **Cursor** — `~/.cursor/rules/*.mdc`, `~/.cursor/AGENTS.md` (aggregate), `~/.cursor/mcp.json`, `~/.cursor/hooks.json`, `~/.cursorignore`, plus skills, agents, and commands under `~/.cursor/`; legacy `~/.agentsmesh-exports/cursor/user-rules.md` is still read on import when present; `agentsmesh import --global --from cursor` maps those paths back into `~/.agentsmesh/`
- **Copilot** — `~/.copilot/copilot-instructions.md`, `~/.copilot/agents/*.agent.md`, `~/.copilot/skills/`, `~/.copilot/prompts/*.prompt.md`, optional mirror to `~/.agents/skills/` when Codex is **not** also a global target
- **Continue** — `~/.continue/rules/`, `~/.continue/prompts/`, `~/.continue/skills/`, `~/.continue/mcpServers/agentsmesh.json`, optional mirror to `~/.agents/skills/` for embedded skill content
- **Junie** — `~/.junie/AGENTS.md` (aggregate), `~/.junie/skills/`, `~/.junie/agents/*.md`, `~/.junie/commands/*.md`, `~/.junie/mcp/mcp.json`, optional mirror to `~/.agents/skills/` when Codex is **not** also a global target
- **Kiro** — `~/.kiro/steering/AGENTS.md` (aggregate), `~/.kiro/steering/*.md` (per-rule files), `~/.kiro/agents/*.md`, `~/.kiro/skills/`, `~/.kiro/settings/mcp.json`, `~/.kiro/settings/kiroignore`, optional mirror to `~/.agents/skills/` when Codex is **not** also a global target
- **Gemini CLI** — `~/.gemini/GEMINI.md`, `~/.gemini/AGENTS.md` (compatibility aggregate), `~/.gemini/settings.json` (includes MCP and hooks), `~/.gemini/commands/*.toml`, `~/.gemini/skills/`, `~/.gemini/agents/*.md` (experimental), optional mirror to `~/.agents/skills/` when Codex is **not** also a global target
- **Cline** — `~/Documents/Cline/Rules/`, `~/Documents/Cline/Workflows/`, `~/Documents/Cline/Hooks/`, `~/.cline/skills/`, `~/.cline/cline_mcp_settings.json`, `~/.clineignore`, optional mirror to `~/.agents/skills/`
- **Codex CLI** — `~/.codex/AGENTS.md`, `~/.codex/config.toml`, `~/.codex/agents/*.toml`, `~/.codex/rules/*.rules` when rules use execution semantics, and `~/.agents/skills/` for skills
- **Windsurf** — `~/.codeium/windsurf/memories/global_rules.md`, `~/.codeium/windsurf/skills/`, `~/.codeium/windsurf/global_workflows/`, `~/.codeium/windsurf/hooks.json`, `~/.codeium/windsurf/mcp_config.json`, `~/.codeium/.codeiumignore`, optional mirror to `~/.agents/skills/` when Codex is **not** also a global target
- **Antigravity** — `~/.gemini/antigravity/GEMINI.md`, `~/.gemini/antigravity/skills/`, `~/.gemini/antigravity/workflows/`, and `~/.gemini/antigravity/mcp_config.json`
- **Roo Code** — `~/.roo/AGENTS.md` (compatibility aggregate), `~/.roo/rules/*.md`, `~/.roo/commands/*.md`, `~/.roo/skills/`, `~/mcp_settings.json`, `~/.rooignore`, optional mirror to `~/.agents/skills/` when Codex is **not** also a global target

See the [supported tools matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/#global-mode) for project vs global capability notes per target.

That's it. Your `.agentsmesh/` directory is now the single source of truth, and the generated files for each tool stay in sync with it.

---

## Supported Tools

### Project scope (`agentsmesh generate`)

| Feature       | Claude Code | Cursor  | Copilot | Continue | Junie    | Kiro   | Gemini CLI | Cline   | Codex CLI | Windsurf | Antigravity | Roo Code |
|---------------|:-----------:|:-------:|:-------:|:--------:|:--------:|:------:|:----------:|:-------:|:---------:|:--------:|:-----------:|:--------:|
| Rules         | Native      | Native  | Native  | Native   | Native   | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| Commands      | Native      | Native  | Native  | Embedded | Embedded | --     | Native     | Native  | Embedded  | Native   | Partial     | Native   |
| Agents        | Native      | Native  | Native  | --       | Embedded | Native | Native     | Embedded| Native    | Embedded | --          | --       |
| Skills        | Native      | Native  | Native  | Embedded | Embedded | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| MCP Servers   | Native      | Native  | --      | Native   | Native   | Native | Native     | Native  | Native    | Partial  | --          | Native   |
| Hooks         | Native      | Native  | Partial | --       | --       | Native | Partial    | Native  | --        | Native   | --          | --       |
| Ignore        | Native      | Native  | --      | --       | Native   | Native | Native     | Native  | --        | Native   | --          | Native   |
| Permissions   | Native      | Partial | --      | --       | --       | --     | Partial    | --      | --        | --       | --          | --       |

### Global scope (`agentsmesh matrix --global`)

| Feature       | Claude Code | Cursor  | Copilot | Continue | Junie    | Kiro   | Gemini CLI | Cline   | Codex CLI | Windsurf | Antigravity | Roo Code |
|---------------|:-----------:|:-------:|:-------:|:--------:|:--------:|:------:|:----------:|:-------:|:---------:|:--------:|:-----------:|:--------:|
| Rules         | Native      | Native  | Native  | Native   | Native   | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| Commands      | Native      | Native  | Native  | Native   | Native   | --     | Native     | Native  | Embedded  | Native   | Partial     | Native   |
| Agents        | Native      | Native  | Native  | --       | Native   | Native | Native     | Embedded| Native    | Embedded | --          | --       |
| Skills        | Native      | Native  | Native  | Native   | Native   | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| MCP Servers   | Native      | Native  | --      | Native   | Native   | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| Hooks         | Native      | Native  | --      | --       | --       | --     | Partial    | Native  | --        | Native   | --          | --       |
| Ignore        | Native      | Native  | --      | --       | --       | Native | --         | Native  | --        | Native   | --          | Native   |
| Permissions   | Native      | --      | --      | --       | --       | --     | --         | --      | --        | --       | --          | --       |

See the [full feature matrix docs](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for details on native vs. embedded support and global paths.

**Note:** The canonical root rule always lives at `.agentsmesh/rules/_root.md`. Some targets write that content to a tool-specific main file named `general` (for example `.continue/rules/general.md` and `.agents/rules/general.md` for Antigravity) instead of `_root.md` on disk.

---

## Documentation

The documentation site covers everything in detail:

- **[Getting Started](https://samplexbro.github.io/agentsmesh/getting-started/installation/)** -- installation, quick start
- **[Canonical Config](https://samplexbro.github.io/agentsmesh/canonical-config/)** -- rules, commands, agents, skills, MCP, hooks, ignore, permissions
- **[CLI Reference](https://samplexbro.github.io/agentsmesh/cli/)** -- all commands: init, generate, import, install, diff, lint, watch, check, merge, matrix
- **[Configuration](https://samplexbro.github.io/agentsmesh/configuration/agentsmesh-yaml/)** -- agentsmesh.yaml, local overrides, extends, collaboration, conversions
- **[Guides](https://samplexbro.github.io/agentsmesh/guides/existing-project/)** -- adopting in existing projects, multi-tool teams, sharing config, CI drift detection, community packs
- **[Reference](https://samplexbro.github.io/agentsmesh/reference/generation-pipeline/)** -- how the generation pipeline works

## Contributing

Contributions are welcome. Keep changes small, test them, and prefer editing canonical `.agentsmesh/` sources over generated files.

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
