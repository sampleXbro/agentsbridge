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

That's it. Your `.agentsmesh/` directory is now the single source of truth, and the generated files for each tool stay in sync with it.

---

## Supported Tools

| Feature       | Claude Code | Cursor  | Copilot | Continue | Junie    | Kiro   | Gemini CLI | Cline   | Codex CLI | Windsurf | Antigravity | Roo Code |
|---------------|:-----------:|:-------:|:-------:|:--------:|:--------:|:------:|:----------:|:-------:|:---------:|:--------:|:-----------:|:--------:|
| Rules         | Native      | Native  | Native  | Native   | Native   | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| Commands      | Native      | Native  | Native  | Embedded | Embedded | --     | Native     | Native  | Embedded  | Native   | Partial     | Native   |
| Agents        | Native      | Native  | Native  | --       | Embedded | --     | Native     | Embedded| Native    | Embedded | --          | --       |
| Skills        | Native      | Native  | Native  | Embedded | Embedded | Native | Native     | Native  | Native    | Native   | Native      | Native   |
| MCP Servers   | Native      | Native  | --      | Native   | Native   | Native | Native     | Native  | Native    | Partial  | --          | Native   |
| Hooks         | Native      | Native  | Partial | --       | --       | Native | Partial    | --      | --        | Native   | --          | --       |
| Ignore        | Native      | Native  | --      | --       | Native   | Native | Native     | Native  | --        | Native   | --          | Native   |
| Permissions   | Native      | Partial | --      | --       | --       | --     | Partial    | --      | --        | --       | --          | --       |

See the [full feature matrix docs](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for details on native vs. embedded support.

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
