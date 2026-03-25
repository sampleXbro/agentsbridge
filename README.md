# AgentsBridge

[![CI](https://github.com/sampleXbro/agentsbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsbridge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsbridge.svg)](https://www.npmjs.com/package/agentsbridge)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsbridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/agentsbridge.svg)](https://nodejs.org/)
[![npm downloads](https://img.shields.io/npm/dm/agentsbridge.svg)](https://www.npmjs.com/package/agentsbridge)

AgentsBridge gives you one canonical AI config in `.agentsbridge/` and syncs it to the tools your team actually uses: Claude Code, Cursor, Copilot, Continue, Junie, Gemini CLI, Cline, Codex CLI, and Windsurf.

The point is simple: keep one source of truth for rules, commands, agents, skills, MCP, hooks, ignore patterns, and permissions, then generate the right format for each tool without hand-editing nine different config layouts.

## Why it is useful

- One canonical config instead of tool-by-tool drift
- Import existing configs before you standardize anything
- Generate back out to multiple tools from the same source
- Keep team changes safe with lock files, drift checks, and merge recovery
- See support clearly with a built-in compatibility matrix
- Share base configs across repos with `extends`
- Keep personal preferences local with `agentsbridge.local.yaml`
- Preserve links and supporting files when content moves between targets

## What ships today

AgentsBridge already covers the pieces most teams care about in practice:

- Rules, commands, agents, skills, MCP servers, hooks, ignore patterns, and permissions
- Bidirectional import/generate flow across 9 supported targets
- `diff`, `lint`, `watch`, `check`, `merge`, and `matrix` commands
- Local overrides with `agentsbridge.local.yaml`
- Remote and local `extends` support
- Lock file based collaboration for generated state
- Link rebasing so internal file references still make sense after generation
- Target-specific conversions where native support does not exist

The strongest parts of the library right now are the operational pieces competitors usually skip: permissions syncing, lock file handling, diffing, linting, watch mode, local overrides, link rebasing, and the compatibility matrix.

## Supported tools

| Tool | Current support |
| --- | --- |
| Claude Code | Native rules, commands, agents, skills, MCP, hooks, ignore, permissions |
| Cursor | Native rules, commands, agents, skills, MCP, hooks, ignore; partial permissions |
| Copilot | Native rules, commands, agents, skills; partial hooks |
| Continue | Native rules and MCP; commands via embedded invokable prompt rules; skills via embedded skill directories |
| Junie | Partial rules via a single project guidelines file; embedded skills; native MCP and ignore |
| Gemini CLI | Native rules, commands, skills, MCP, ignore; partial hooks; agents via projected skills |
| Cline | Native rules, workflows-from-commands, skills, MCP, ignore; agents via projected skills |
| Codex CLI | Native rules, skills, MCP; commands and agents via projected skills |
| Windsurf | Native rules, workflows-from-commands, skills, ignore; agents via projected skills |

Embedded support is deliberate, not a hacky one-way export. For example, Codex commands are round-tripped through reserved skills, and projected agent-skills keep enough metadata for `import --from ...` to restore canonical agents instead of flattening them into plain skills.

## Install

```bash
pnpm add -D agentsbridge
# or
npm install -D agentsbridge
```

Requires Node.js 20+. The CLI is available as `agentsbridge` and `agbr`.

## Quick start

```bash
# create the canonical scaffold
agentsbridge init

# sync .agentsbridge/ to the configured targets
agentsbridge generate
```

If the repo already has tool-specific config, import it first:

```bash
agentsbridge import --from cursor
agentsbridge generate
```

## Canonical layout

```text
.agentsbridge/
  rules/_root.md
  rules/*.md
  commands/*.md
  agents/*.md
  skills/{name}/SKILL.md
  mcp.json
  permissions.yaml
  hooks.yaml
  ignore
agentsbridge.yaml
agentsbridge.local.yaml
```

What each part does:

- `rules/`: shared instructions, including the required root rule, target scoping, globs, and optional trigger modes
- `commands/`: reusable slash-command style prompts
- `agents/`: custom subagents with tools, model, hooks, MCP, skills, and memory
- `skills/`: skills plus supporting files
- `mcp.json`: MCP server definitions
- `permissions.yaml`: allow/deny lists
- `hooks.yaml`: lifecycle hooks
- `ignore`: shared ignore patterns
- `agentsbridge.local.yaml`: local-only overrides that should not be committed

## CLI commands

Global flags:

- `--help`
- `--version`
- `--verbose`

| Command | What it does | Supported flags |
| --- | --- | --- |
| `init` | Create `agentsbridge.yaml`, `.agentsbridge/`, `agentsbridge.local.yaml`, and update `.gitignore` | `--yes` |
| `generate` | Generate target files from `.agentsbridge/` | `--targets`, `--dry-run`, `--check`, `--force`, `--refresh-cache`, `--no-cache` |
| `import` | Import an existing tool config into `.agentsbridge/` | `--from` |
| `install` | Install resources from a local/remote source and materialize them as packs or extends | `--sync`, `--dry-run`, `--force`, `--path`, `--target`, `--as`, `--name`, `--extends` |
| `diff` | Show what the next `generate` would change without writing files | `--targets` |
| `lint` | Validate canonical files against target constraints | `--targets` |
| `watch` | Watch canonical files and regenerate on change | `--targets` |
| `check` | Verify the canonical state still matches the lock file | none |
| `merge` | Resolve `.agentsbridge/.lock` merge conflicts | none |
| `matrix` | Show feature support for the current config | `--targets`, `--verbose` |
| `help` | Show command help | n/a (also via global `--help`) |
| `version` | Show CLI/library version | n/a (also via global `--version`) |

Examples:

```bash
agentsbridge init --yes
agentsbridge generate --targets cursor,claude-code
agentsbridge generate --dry-run
agentsbridge generate --check
agentsbridge generate --refresh-cache
agentsbridge import --from codex-cli
agentsbridge install github:org/repo@main --path skills --as skills
agentsbridge diff --targets windsurf
agentsbridge lint
agentsbridge watch
agentsbridge check
agentsbridge merge
agentsbridge matrix --verbose
agentsbridge --help
agentsbridge --version
```

## Features worth knowing about

- `extends` can pull shared config from a local folder, GitHub release, GitLab repo, or generic git remote
- `agentsbridge.local.yaml` lets one developer narrow targets or disable conversions without changing the shared project config
- Conversion controls let you turn off projected command-to-skill or agent-to-skill mappings per target
- `watch` ignores its own lock-file writes, so generation does not loop on itself
- `check` and `merge` are built for team workflows, not just solo local use

Example `extends` config:

```yaml
extends:
  - source: ../shared-ai-config
    features: [rules, commands]
  - source: github:my-org/ai-config@v1.0.0
    features: [rules, permissions]
  - source: gitlab:team/platform/ai-config@v2.3.1
    features: [rules]
  - source: git+ssh://git@git.example.com/platform/ai-config.git#main
    features: [rules, commands, permissions]
```

## Roadmap

This section is planned work, not current functionality.

### Tier 1

- Global mode for user-level config outside a single repo
- Programmatic API for `generate`, `lint`, and `diff`
- More targets: Roo Code, Kilo Code, Goose, Kiro, OpenCode, Factory Droid, Google Antigravity
- Homebrew distribution and a single binary build
- `--json` output on command results
- Dedicated `.gitignore` command
- MCP server so agents can inspect and manage their own config

### Tier 2

- `.gitattributes` auto-generation for generated files
- `convert` for direct tool-to-tool conversion
- Ephemeral generation mode (`--stdout`, temp output)
- Plugin system for custom targets
- JSON Schema for `agentsbridge.yaml`

### Tier 3

- Community registry for shared rule sets and configs
- `migrate --from <tool>` for zero-friction imports from other AI config tools
- IDE extension for VS Code and JetBrains

## Development commands

```bash
pnpm build
pnpm test
pnpm test:watch
pnpm test:coverage
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check
```

## Contributing

Keep changes small, verify them, and prefer updating the canonical `.agentsbridge/` source over editing generated target files by hand.
