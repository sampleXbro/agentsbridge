# AgentsMesh

[![CI](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsmesh/branch/master/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsmesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/agentsmesh.svg)](https://nodejs.org/)
[![npm downloads](https://img.shields.io/npm/dm/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)

**One config. Nine AI coding tools. Zero drift.**

AgentsMesh maintains a single canonical configuration in `.agentsmesh/` and syncs it bidirectionally to Claude Code, Cursor, Copilot, Continue, Junie, Gemini CLI, Cline, Codex CLI, and Windsurf. Rules, commands, agents, skills, MCP servers, hooks, ignore patterns, and permissions -- all from one source of truth.

---

**Table of Contents**

- [Why AgentsMesh](#why-agentsmesh)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Supported Tools](#supported-tools)
- [Canonical Configuration](#canonical-configuration)
  - [Rules](#rules)
  - [Commands](#commands)
  - [Agents](#agents)
  - [Skills](#skills)
  - [MCP Servers](#mcp-servers)
  - [Permissions](#permissions)
  - [Hooks](#hooks)
  - [Ignore Patterns](#ignore-patterns)
- [CLI Reference](#cli-reference)
  - [Global Flags](#global-flags)
  - [init](#init)
  - [generate](#generate)
  - [import](#import)
  - [install](#install)
  - [diff](#diff)
  - [lint](#lint)
  - [watch](#watch)
  - [check](#check)
  - [merge](#merge)
  - [matrix](#matrix)
- [Configuration](#configuration)
  - [agentsmesh.yaml](#agentsmeshyaml)
  - [Local Overrides](#local-overrides)
  - [Extends](#extends)
  - [Collaboration Settings](#collaboration-settings)
  - [Conversions](#conversions)
- [Workflows](#workflows)
  - [Adopting AgentsMesh in an Existing Project](#adopting-agentsmesh-in-an-existing-project)
  - [Supporting Multiple Tools on a Team](#supporting-multiple-tools-on-a-team)
  - [Sharing Config Across Repositories](#sharing-config-across-repositories)
  - [CI Drift Detection](#ci-drift-detection)
  - [Installing Community Packs](#installing-community-packs)
  - [Local Development Overrides](#local-development-overrides)
- [How Generation Works](#how-generation-works)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why AgentsMesh

If your team uses more than one AI coding tool -- or even if you just use one today and might switch tomorrow -- you already know the pain. Each tool has its own config format, its own directory structure, its own way of defining rules, commands, and MCP servers. Change a rule in `.cursor/rules/`, forget to update `.claude/rules/`, and your agents start behaving differently depending on who is editing. Scale that across a team where half the developers use Cursor and the other half use Claude Code, and config drift becomes a real problem.

AgentsMesh solves this by giving you a single canonical directory (`.agentsmesh/`) that holds all your AI tool configuration. When you run `agentsmesh generate`, it produces the correct output for every tool your team uses. When someone on the team already has tool-specific config, `agentsmesh import` brings it into the canonical format. The round-trip is lossless: what goes in comes back out, including internal file references, supporting skill files, and embedded metadata.

**What sets AgentsMesh apart from manual management:**

- **One source of truth** -- edit `.agentsmesh/`, generate everywhere. No more copy-pasting rules between tool directories.
- **Bidirectional sync** -- import existing configs into canonical form and generate back out. No data loss, no manual reformatting.
- **Team-safe collaboration** -- lock files track generated state, `check` catches drift in CI, `merge` resolves conflicts after `git merge`.
- **Lossless feature projection** -- when a tool lacks native support for a feature (e.g., Codex CLI has no commands), AgentsMesh projects it as an embedded skill with enough metadata to round-trip on re-import.
- **Real operational tooling** -- `diff`, `lint`, `watch`, `check`, `merge`, and `matrix` are first-class commands, not afterthoughts. Most config tools stop at "generate and hope for the best."

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

AgentsMesh supports 9 AI coding tools with varying levels of feature support per tool. "Native" means the feature maps directly to the tool's own config format. "Embedded" means AgentsMesh projects the feature into a compatible format (e.g., converting commands to invokable skills) with enough metadata for lossless round-trip. "Partial" means limited support.

| Feature       | Claude Code | Cursor  | Copilot | Gemini CLI | Cline   | Codex CLI | Windsurf | Continue | Junie    |
|---------------|:-----------:|:-------:|:-------:|:----------:|:-------:|:---------:|:--------:|:--------:|:--------:|
| Rules         | Native      | Native  | Native  | Native     | Native  | Native    | Native   | Native   | Native   |
| Commands      | Native      | Native  | Native  | Native     | Native  | Embedded  | Native   | Embedded | Embedded |
| Agents        | Native      | Native  | Native  | Native     | Embedded| Native    | Embedded | --       | Embedded |
| Skills        | Native      | Native  | Native  | Native     | Native  | Native    | Native   | Embedded | Embedded |
| MCP Servers   | Native      | Native  | --      | Native     | Native  | Native    | Partial  | Native   | Native   |
| Hooks         | Native      | Native  | Partial | Partial    | --      | --        | Native   | --       | --       |
| Ignore        | Native      | Native  | --      | Native     | Native  | --        | Native   | --       | Native   |
| Permissions   | Native      | Partial | --      | Partial    | --      | --        | --       | --       | --       |

Embedded support is deliberate, not a workaround. Projected features carry enough metadata that `agentsmesh import` can restore them to their original canonical form, not flatten them into plain text.

---

## Canonical Configuration

The `.agentsmesh/` directory is the single source of truth. Everything below is a reference for the canonical file formats.

```
.agentsmesh/
  rules/
    _root.md            # Root rule (always applied, required)
    *.md                # Additional rules (scoped by target or glob)
  commands/
    *.md                # Slash-command-style prompts
  agents/
    *.md                # Subagent definitions
  skills/
    {name}/
      SKILL.md          # Skill definition
      *.*               # Supporting files (templates, references, etc.)
  mcp.json              # MCP server definitions
  permissions.yaml      # Allow/deny tool permission lists
  hooks.yaml            # Lifecycle hooks
  ignore                # gitignore-style exclusion patterns
  installs.yaml         # Record of installed packs
  .lock                 # Generated state checksums (managed by CLI)
agentsmesh.yaml         # Project configuration
agentsmesh.local.yaml   # Local overrides (gitignored)
```

### Rules

Rules are markdown files with optional YAML frontmatter. The root rule (`_root.md`) is required and always applied. Additional rules can be scoped to specific targets or file patterns.

```markdown
---
root: true
---

# Project Guidelines

- Write tests before implementation.
- Max 200 lines per file.
- Use TypeScript strict mode.
```

Scoped rule example:

```markdown
---
description: Frontend conventions
targets: [cursor, claude-code]
globs: [src/components/**/*.tsx]
---

Use functional components with hooks. No class components.
Prefer Tailwind utility classes over custom CSS.
```

**Frontmatter fields:**

| Field                     | Type       | Description                                                        |
|---------------------------|------------|--------------------------------------------------------------------|
| `root`                    | `boolean`  | Always-applied rule. Required for `_root.md`.                      |
| `description`             | `string`   | Human-readable rule name.                                          |
| `targets`                 | `string[]` | Limit rule to specific tools. Empty = all targets.                 |
| `globs`                   | `string[]` | File patterns this rule applies to (tool-dependent).               |
| `trigger`                 | `string`   | Activation mode hint for Windsurf: `always_on`, `model_decision`, `glob`, `manual`. |
| `codexEmit`               | `string`   | Codex CLI instruction type: `advisory` or `execution`.             |
| `codexInstructionVariant` | `string`   | Codex nested instruction format: `default` or `override`.          |

### Commands

Commands are reusable prompts that map to slash commands in tools that support them (Claude Code, Cursor, Copilot, Gemini CLI). For tools without native command support, they are projected as invokable skills.

```markdown
---
description: Create a conventional commit from current changes
allowed-tools:
  - Read
  - Bash(git status)
  - Bash(git diff)
  - Bash(git add)
  - Bash(git commit)
---

Review the current git changes. Analyze what was modified and why.
Draft a conventional commit message (feat/fix/refactor/test/docs scope).
Stage the relevant files and commit.
```

**Frontmatter fields:**

| Field           | Type       | Description                                        |
|-----------------|------------|----------------------------------------------------|
| `description`   | `string`   | Short description shown in command menus.           |
| `allowed-tools` | `string[]` | Tools the command is allowed to use when invoked.   |

### Agents

Agents define custom subagents with their own tools, model, permissions, hooks, and skills.

```markdown
---
name: code-reviewer
description: Reviews code changes for quality and security issues
tools:
  - Read
  - Grep
  - Glob
  - Bash(git diff)
  - Bash(git log)
model: sonnet
permissionMode: ask
maxTurns: 10
mcpServers:
  - github
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      type: command
      command: "eslint --fix $FILE"
skills:
  - security-review
memory: .context/review-history.md
---

You are a senior code reviewer. Focus on logic correctness, performance,
security vulnerabilities, and adherence to project conventions.

Flag issues by severity. Suggest concrete fixes, not vague recommendations.
```

**Frontmatter fields:**

| Field             | Type       | Description                                                     |
|-------------------|------------|-----------------------------------------------------------------|
| `name`            | `string`   | Agent identifier.                                                |
| `description`     | `string`   | Short description.                                               |
| `tools`           | `string[]` | Allowed tools (Read, Grep, Bash, etc.).                          |
| `disallowedTools` | `string[]` | Explicitly denied tools.                                         |
| `model`           | `string`   | Model hint: `sonnet`, `opus`, `haiku`.                           |
| `permissionMode`  | `string`   | How permissions are handled: `ask`, `default`, `none`.           |
| `maxTurns`        | `number`   | Maximum conversation turns.                                      |
| `mcpServers`      | `string[]` | MCP servers available to this agent.                             |
| `hooks`           | `object`   | Agent-level lifecycle hooks (same format as `hooks.yaml`).       |
| `skills`          | `string[]` | Skills available to this agent.                                  |
| `memory`          | `string`   | Path to external memory file.                                    |

### Skills

Skills are directories containing a `SKILL.md` definition and any supporting files (templates, reference docs, examples). Supporting files are preserved across generation and import.

```
.agentsmesh/skills/
  api-generator/
    SKILL.md
    template.hbs
    examples/
      user-api.ts
```

```markdown
---
description: Generate REST API endpoints from OpenAPI specs
---

Given an OpenAPI specification file, generate TypeScript route handlers
with request validation, error handling, and response typing.

Reference template: [template.hbs](./template.hbs)
See example: [user-api.ts](./examples/user-api.ts)
```

### MCP Servers

MCP server definitions use a JSON format compatible with the Model Context Protocol.

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "$GITHUB_TOKEN"
      }
    },
    "internal-api": {
      "type": "url",
      "url": "http://localhost:3100/mcp",
      "headers": {
        "Authorization": "Bearer $API_TOKEN"
      }
    }
  }
}
```

Supports both `stdio` (local process) and `url` (HTTP endpoint) server types. Environment variables use `$VAR` syntax and are resolved at runtime by each tool.

### Permissions

Allow/deny lists for tool operations. Mainly consumed by Claude Code (native) and Cursor/Gemini CLI (partial).

```yaml
allow:
  - Read
  - Grep
  - Glob
  - Bash(pnpm test:*)
  - Bash(pnpm build:*)
  - Bash(git add:*)
  - Bash(git commit:*)
deny:
  - WebFetch
  - Bash(curl:*)
  - Bash(rm -rf:*)
  - Read(.env)
```

Patterns support wildcards. `Bash(pnpm test:*)` allows any `pnpm test:` subcommand.

### Hooks

Lifecycle hooks that trigger before/after tool use, on notifications, on user prompts, and on subagent lifecycle events.

```yaml
PreToolUse:
  - matcher: "Edit|Write"
    type: command
    command: "eslint --fix $FILE"
    timeout: 30

PostToolUse:
  - matcher: "Bash"
    type: prompt
    prompt: "Review the command output for security concerns."

Notification:
  - matcher: "*"
    type: command
    command: "./scripts/log-notification.sh"

UserPromptSubmit:
  - matcher: "*"
    type: command
    command: "./scripts/prompt-guard.sh"
```

**Hook types:** `PreToolUse`, `PostToolUse`, `Notification`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`

**Entry fields:**

| Field     | Type     | Description                                          |
|-----------|----------|------------------------------------------------------|
| `matcher` | `string` | Regex pattern for which tool/event triggers the hook. |
| `type`    | `string` | `command` (run a shell command) or `prompt` (inject a prompt). |
| `command` | `string` | Shell command to execute (when `type: command`).      |
| `prompt`  | `string` | Prompt text to inject (when `type: prompt`).          |
| `timeout` | `number` | Timeout in seconds (optional).                        |

### Ignore Patterns

A gitignore-style file listing patterns that AI tools should not index or read.

```
node_modules
dist
.env
.env.*
*.log
.DS_Store
coverage
```

---

## CLI Reference

### Global Flags

| Flag        | Description                           |
|-------------|---------------------------------------|
| `--help`    | Show help output and exit.            |
| `--version` | Print CLI version and exit.           |
| `--verbose` | Show full error stack traces on failure. |

### init

Create the canonical scaffold: `agentsmesh.yaml`, `agentsmesh.local.yaml`, `.agentsmesh/` directory with a starter `_root.md` rule, and update `.gitignore`.

```bash
agentsmesh init [flags]
```

| Flag    | Description                                             |
|---------|---------------------------------------------------------|
| `--yes` | Auto-import any detected tool configs without prompting. |

During init, AgentsMesh scans the project for existing AI tool configurations (`.claude/`, `.cursor/`, `.cline/`, `.junie/`, `.continue/`, `.gemini/`, `.codex/`, `.windsurf/`, `.github/copilot-instructions.md`). If found, it offers to import them into the canonical directory.

```bash
# Interactive mode (prompts for each detected config)
agentsmesh init

# Auto-import everything detected
agentsmesh init --yes
```

### generate

Generate target-specific config files from the canonical `.agentsmesh/` directory.

```bash
agentsmesh generate [flags]
```

| Flag               | Description                                                |
|--------------------|------------------------------------------------------------|
| `--targets <csv>`  | Comma-separated list of target IDs to generate for.        |
| `--dry-run`        | Preview changes without writing any files.                 |
| `--check`          | Verify sync status only. Exit code 1 if out of sync.      |
| `--force`          | Bypass collaboration lock violations.                      |
| `--refresh-cache`  | Re-fetch remote extends sources before generating.         |
| `--no-cache`       | Alias for `--refresh-cache`.                               |

```bash
# Generate for all configured targets
agentsmesh generate

# Generate for specific targets only
agentsmesh generate --targets claude-code,cursor

# Preview what would change
agentsmesh generate --dry-run

# CI check: fail if generated files are out of date
agentsmesh generate --check

# Force through locked feature protections
agentsmesh generate --force

# Refresh remote extends cache
agentsmesh generate --refresh-cache
```

### import

Import an existing tool's config into the canonical `.agentsmesh/` directory.

```bash
agentsmesh import --from <target>
```

| Flag             | Description                                             |
|------------------|---------------------------------------------------------|
| `--from <target>`| Source tool ID to import from (required).                |

Valid targets: `claude-code`, `cursor`, `copilot`, `continue`, `junie`, `gemini-cli`, `cline`, `codex-cli`, `windsurf`

```bash
# Import existing Claude Code configuration
agentsmesh import --from claude-code

# Import Cursor rules and settings
agentsmesh import --from cursor

# Import from any supported tool
agentsmesh import --from copilot
agentsmesh import --from gemini-cli
agentsmesh import --from cline
agentsmesh import --from codex-cli
agentsmesh import --from windsurf
agentsmesh import --from continue
agentsmesh import --from junie
```

The import process maps tool-specific config to the canonical format:
- `.claude/rules/*.md` becomes `.agentsmesh/rules/*.md`
- `.claude/settings.json` permissions become `.agentsmesh/permissions.yaml`
- `.cursor/rules/*.mdc` gets converted to standard markdown
- Skills, agents, commands, MCP, hooks, and ignore patterns are all mapped to their canonical equivalents

Internal file references (links between skills, supporting file paths) are rewritten from tool-specific paths to canonical paths, so cross-references stay valid.

### install

Install rules, commands, agents, or skills from a remote or local source.

```bash
agentsmesh install <source> [flags]
```

| Flag             | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `<source>`       | GitHub/GitLab URL, git URL, SSH, or local path.                   |
| `--path <dir>`   | Subdirectory within the source repo to install from.              |
| `--target <id>`  | Hint for native format auto-discovery (e.g., `claude-code`).     |
| `--as <kind>`    | Manual mode: install as `rules`, `commands`, `agents`, or `skills`. |
| `--name <id>`    | Override the generated install entry name.                        |
| `--extends`      | Record as an extends entry instead of a materialized pack.        |
| `--sync`         | Reinstall missing packs from `.agentsmesh/installs.yaml`.        |
| `--dry-run`      | Preview what would be installed without writing.                  |
| `--force`        | Non-interactive mode: include all resources, skip prompts.        |

**Source formats:**

| Format                                           | Example                                  |
|--------------------------------------------------|------------------------------------------|
| GitHub shorthand                                 | `github:org/repo@v1.0.0`                |
| GitLab shorthand                                 | `gitlab:group/repo@main`                |
| Git SSH                                          | `git+ssh://git@github.com/org/repo#main`|
| Local path                                       | `local:../shared-config`                 |

```bash
# Auto-discover and install from a GitHub repo
agentsmesh install github:org/shared-rules@v2.0.0

# Install specific skills from a subdirectory
agentsmesh install github:org/repo --path skills --as skills

# Cherry-pick specific items
agentsmesh install github:org/repo --as agents --name team-agents

# Record as extends (linked, not materialized)
agentsmesh install github:org/base-config --extends

# Reinstall missing packs after a fresh clone
agentsmesh install --sync

# Preview before committing
agentsmesh install github:org/repo --dry-run
```

Installed packs are written to `.agentsmesh/packs/` and tracked in `.agentsmesh/installs.yaml`. They merge with your canonical config during generation.

### diff

Show a unified diff of what the next `generate` would change, without writing anything.

```bash
agentsmesh diff [flags]
```

| Flag            | Description                                          |
|-----------------|------------------------------------------------------|
| `--targets <csv>` | Limit diff output to specific target IDs.          |

```bash
# See all pending changes
agentsmesh diff

# See changes for Windsurf only
agentsmesh diff --targets windsurf
```

### lint

Validate canonical files against target-specific constraints. Each target has its own linting rules -- for example, Cursor requires `.mdc` format compliance, Claude Code validates `settings.json` schema, and all targets check for valid frontmatter.

```bash
agentsmesh lint [flags]
```

| Flag            | Description                                      |
|-----------------|--------------------------------------------------|
| `--targets <csv>` | Limit linting to specific target IDs.          |

```bash
# Lint for all configured targets
agentsmesh lint

# Lint for Cursor constraints only
agentsmesh lint --targets cursor
```

### watch

Watch the `.agentsmesh/` directory for changes and automatically regenerate on save. Uses a 300ms debounce to batch rapid edits. The watch loop ignores its own lock file writes to prevent infinite regeneration cycles.

```bash
agentsmesh watch [flags]
```

| Flag            | Description                                      |
|-----------------|--------------------------------------------------|
| `--targets <csv>` | Limit regeneration to specific target IDs.     |

```bash
# Watch and regenerate for all targets
agentsmesh watch

# Watch and regenerate for Claude Code only
agentsmesh watch --targets claude-code
```

### check

Verify that the canonical files still match the lock file (`.agentsmesh/.lock`). Designed for CI pipelines -- exits with code 1 if generated files have drifted.

```bash
agentsmesh check
```

No flags. Returns exit code 0 if everything is in sync, 1 if drift is detected.

### merge

Resolve `.agentsmesh/.lock` merge conflicts after a `git merge`. Rebuilds the lock file from the current canonical state.

```bash
agentsmesh merge
```

No flags. Run this after `git merge` when the lock file has conflicts.

### matrix

Display the feature-target compatibility matrix for your current configuration.

```bash
agentsmesh matrix [flags]
```

| Flag            | Description                                           |
|-----------------|-------------------------------------------------------|
| `--targets <csv>` | Limit matrix columns to specific target IDs.       |
| `--verbose`     | Show detailed feature notes alongside the matrix.     |

```bash
# Show full matrix
agentsmesh matrix

# Show matrix for specific targets
agentsmesh matrix --targets claude-code,cursor,copilot

# Show matrix with detailed notes
agentsmesh matrix --verbose
```

---

## Configuration

### agentsmesh.yaml

The main project configuration file. Created by `agentsmesh init`.

```yaml
version: 1

# Which tools to generate config for
targets:
  - claude-code
  - cursor
  - copilot
  - gemini-cli
  - cline
  - codex-cli
  - windsurf
  - continue
  - junie

# Which features to sync (all enabled by default)
features:
  - rules
  - commands
  - agents
  - skills
  - mcp
  - hooks
  - ignore
  - permissions

# Inherit shared config from other sources
extends:
  - name: company-standards
    source: github:my-org/ai-config@v1.0.0
    features: [rules, commands, permissions]

# Team collaboration settings
collaboration:
  strategy: merge
  lock_features:
    - mcp
    - permissions
```

**Top-level fields:**

| Field           | Type       | Description                                                  |
|-----------------|------------|--------------------------------------------------------------|
| `version`       | `number`   | Config version. Currently `1`.                               |
| `targets`       | `string[]` | Tool IDs to generate config for.                             |
| `features`      | `string[]` | Features to sync. Omit to enable all.                        |
| `extends`       | `array`    | Shared config sources to inherit from.                       |
| `overrides`     | `object`   | Per-target overrides (keyed by target ID).                   |
| `collaboration` | `object`   | Team collaboration and lock settings.                        |
| `conversions`   | `object`   | Control feature projection behavior per target.              |

### Local Overrides

`agentsmesh.local.yaml` is gitignored and allows individual developers to customize their setup without affecting the shared config.

```yaml
# Only generate for the tools I use
targets:
  - claude-code

# Skip features I don't need locally
features:
  - rules
  - commands
  - skills
  - mcp
```

Local overrides narrow the scope -- they cannot add targets or features that the project config does not define.

### Extends

Pull shared configuration from remote repositories, other local projects, or Git URLs.

```yaml
extends:
  # GitHub release
  - name: company-rules
    source: github:my-org/ai-config@v1.0.0
    features: [rules, commands]

  # GitLab repo
  - name: platform-config
    source: gitlab:infra/ai-standards@v2.3.1
    features: [rules, permissions]

  # Git SSH
  - name: private-rules
    source: git+ssh://git@github.com/org/config.git#main
    features: [rules]

  # Local directory (monorepo shared config)
  - name: shared-local
    source: ../shared-ai-config
    features: [rules, commands, mcp]
```

**Extends entry fields:**

| Field      | Type       | Description                                                   |
|------------|------------|---------------------------------------------------------------|
| `name`     | `string`   | Identifier for this extends entry.                            |
| `source`   | `string`   | Source URL or path.                                           |
| `version`  | `string`   | Version tag (for remote sources).                             |
| `target`   | `string`   | Hint for native format auto-discovery.                        |
| `features` | `string[]` | Which features to inherit from this source.                   |
| `path`     | `string`   | Subdirectory within the source.                               |
| `pick`     | `object`   | Cherry-pick specific resources (e.g., `rules: [style, perf]`).|

Remote sources are cached in `~/.agentsmesh/cache/`. Use `--refresh-cache` on `generate` to force a re-fetch.

### Collaboration Settings

Control how teams work with generated config files.

```yaml
collaboration:
  strategy: merge       # merge | lock | last-wins
  lock_features:
    - mcp
    - permissions
```

| Strategy    | Behavior                                                               |
|-------------|------------------------------------------------------------------------|
| `merge`     | Standard 3-way merge of the lock file. Use `agentsmesh merge` to resolve conflicts. |
| `lock`      | Locked features cannot be regenerated without `--force`. Useful for sensitive config like MCP servers and permissions. |
| `last-wins` | Always overwrite the lock with the latest state.                       |

### Conversions

Control how features are projected when a target lacks native support.

```yaml
conversions:
  # Convert commands to skills for tools that don't have native command support
  commands_to_skills:
    codex-cli: true

  # Convert agents to skills for tools that don't have native agent support
  agents_to_skills:
    cline: true
    windsurf: true
    codex-cli: true
    gemini-cli: true
```

Set a conversion to `false` to disable projection for that target. The feature will simply be skipped instead of being embedded as a skill.

---

## Workflows

### Adopting AgentsMesh in an Existing Project

If the project already has AI tool configs scattered across `.claude/`, `.cursor/`, `.cline/`, and so on:

```bash
# 1. Initialize the canonical directory
agentsmesh init

# 2. Import existing configs (one at a time or use --yes during init)
agentsmesh import --from claude-code
agentsmesh import --from cursor

# 3. Review the canonical files
ls .agentsmesh/rules/
ls .agentsmesh/commands/
cat .agentsmesh/permissions.yaml

# 4. Generate fresh output for all targets
agentsmesh generate

# 5. Verify nothing unexpected changed
agentsmesh diff
```

After this, `.agentsmesh/` is the source of truth. Edit canonical files, run `generate`, and commit both the canonical sources and the generated output.

### Supporting Multiple Tools on a Team

When half the team uses Cursor and the other half uses Claude Code:

```yaml
# agentsmesh.yaml
version: 1
targets:
  - claude-code
  - cursor
features:
  - rules
  - commands
  - agents
  - skills
  - mcp
  - hooks
  - permissions
  - ignore
```

Everyone edits `.agentsmesh/`. Run `agentsmesh generate` after changes. Both `.claude/` and `.cursor/` directories stay in sync. The lock file tracks the generated state so PR reviews can catch drift.

### Sharing Config Across Repositories

Create a shared repo with canonical rules, then reference it with extends:

```yaml
# In each project's agentsmesh.yaml
extends:
  - name: org-standards
    source: github:my-org/ai-standards@v1.2.0
    features: [rules, commands, permissions]
```

When the shared repo publishes a new release, bump the version tag and run `agentsmesh generate --refresh-cache`.

### CI Drift Detection

Add a check step to your CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Verify AI config sync
  run: npx agentsmesh check
```

`agentsmesh check` exits with code 1 if generated files have drifted from the lock file. This catches cases where someone edited `.agentsmesh/` but forgot to regenerate, or edited a generated file directly.

### Installing Community Packs

Install shared skills, rules, or agents from public repositories:

```bash
# Install skills from a public repo
agentsmesh install github:community/ai-skills@v1.0.0

# Install specific skills from a subdirectory
agentsmesh install github:my-org/toolbox --path skills --as skills

# After a fresh clone, reinstall recorded packs
agentsmesh install --sync
```

Installed packs live in `.agentsmesh/packs/` and are tracked in `.agentsmesh/installs.yaml`. They merge into the canonical config during generation.

### Local Development Overrides

Each developer can create `agentsmesh.local.yaml` (gitignored) to customize their local setup:

```yaml
# I only use Claude Code, don't generate Cursor/Copilot files locally
targets:
  - claude-code

# I don't need hooks locally
features:
  - rules
  - commands
  - agents
  - skills
  - mcp
  - permissions
```

This narrows the scope without affecting the shared `agentsmesh.yaml` that the rest of the team uses.

---

## How Generation Works

The generation pipeline follows this sequence:

1. **Load config** -- parse `agentsmesh.yaml`, merge local overrides, validate schema.
2. **Load canonical sources** -- read all files from `.agentsmesh/`, resolve extends (fetch from cache or remote), load installed packs, merge everything.
3. **Generate per target** -- for each enabled target, call target-specific generators for rules, commands, agents, skills, MCP, hooks, ignore, and permissions. Each generator produces `{path, content}` pairs in the target's native format.
4. **Rewrite references** -- internal `.agentsmesh/` file paths are rewritten to target-relative paths (e.g., `.agentsmesh/skills/api-gen/template.hbs` becomes `.claude/skills/api-gen/template.hbs`).
5. **Resolve collisions** -- detect overlapping output paths across features, prefer native over embedded, remove duplicates.
6. **Write output** -- create target directories, write all files, update the lock file with checksums.
7. **Clean stale files** -- remove previously generated files that are no longer in the output set.

On import, the pipeline runs in reverse: tool-specific paths are mapped back to canonical paths, references are restored, and metadata is preserved for round-trip fidelity.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and release timeline.

---

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
