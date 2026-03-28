# Roadmap

Based on community feedback, GitHub issue analysis, and AgentsMesh's existing strengths.

## Principles

- Close gaps that block adoption before adding novel features.
- Leverage existing advantages (permissions, lock files, diff, lint, watch, local overrides) that users are actively requesting.
- Prioritize features by community demand signal.
- Reduce daily friction, not just configuration complexity.

## Current Advantages

AgentsMesh already ships several features that users of other AI config tools are actively requesting:

| Feature                     | Status  | Common gap elsewhere                          |
|-----------------------------|---------|-----------------------------------------------|
| Permissions syncing         | Shipped | Frequently requested, rarely available        |
| Lock file + merge           | Shipped | Not available in most tools                   |
| `diff` command              | Shipped | Most tools only offer `--dry-run` on generate |
| `lint` command              | Shipped | Not available in most tools                   |
| `watch` mode                | Shipped | Not available in most tools                   |
| Local overrides             | Shipped | Frequently requested                          |
| Link rebasing               | Shipped | Not available elsewhere                       |
| Compatibility `matrix`      | Shipped | Not available in most tools                   |

---

## Tier 1: Close the Gaps

### Global Mode

User-level configs across all projects. Expands AgentsMesh from project-scoped to personal developer workflow.

- Support personal/global rules outside a single repo (`~/.agentsmesh/`)
- Define merge precedence between global and project-local config
- Cover tools that have native global support (Claude Code, Codex CLI, Gemini CLI)

### Programmatic API

Expose `import { generate, lint, diff } from 'agentsmesh'` for CI scripts, custom tooling, and automated pipelines.

- Export core functions as a stable public API
- Enable CI/CD integration without CLI subprocess spawning
- Support IDE plugin development

### More Agent Targets

AgentsMesh supports 9 tools. Breadth remains one of the biggest adoption drivers.

Priority targets based on community demand:
- Roo Code / Kilo Code (Cline forks with distinct config)
- Goose
- Kiro
- OpenCode
- Factory Droid
- Google Antigravity

### Distribution: Homebrew + Single Binary

- Publish Homebrew formula
- Ship Node.js SEA (Single Executable Application) binary
- Remove Node.js as a prerequisite for non-JS developers

### `--json` Flag on All Commands

Machine-readable output for scripting and CI pipelines.

- Add `--json` to `generate`, `diff`, `lint`, `check`, `matrix`
- Structured output for programmatic consumption

### `.gitignore` Command

Auto-maintain `.gitignore` entries for generated AI config files.

- `agentsmesh gitignore` to add/update entries
- Respect `--targets` and `--features` filters
- Idempotent -- safe to run repeatedly

### MCP Server

Expose AgentsMesh as an MCP tool so AI agents can inspect and manage their own configuration.

- CRUD operations for rules, commands, agents
- Agent self-introspection
- "AI configures AI" workflows

---

## Tier 2: Differentiate

### `.gitattributes` Auto-Generation

Mark generated files as `linguist-generated` to reduce PR noise and GitHub language statistics pollution.

### `convert` Command

Direct tool-to-tool conversion without going through canonical format.

```bash
agentsmesh convert --from cursor --to claude-code
```

### Ephemeral Mode

Generate configs temporarily without writing to the filesystem.

- `agentsmesh generate --stdout` for piping
- `agentsmesh generate --temp` for Docker builds, CI, testing

### Plugin System for Custom Targets

Let users add custom targets without forking.

- Define a target plugin interface
- `agentsmesh plugin add ./my-custom-target`
- Community-contributed targets without core PRs

### JSON Schema for Config Files

Provide schema files for IDE autocomplete and validation in VS Code, JetBrains, and other editors.

---

## Tier 3: Win the Ecosystem

### Community Registry

`agentsmesh install @org/shared-rules` -- a package registry for rule sets, skills, and configs with discovery, versioning, and pinning.

### `migrate` Command

`agentsmesh migrate --from <tool>` -- zero-friction import from other AI config management tools directly into `.agentsmesh/`.

### IDE Extension

VS Code / JetBrains plugin for visual config editing, compatibility matrix, and one-click generate/diff/lint.

---

## Suggested Release Order

| Version | Focus                                                                  |
|---------|------------------------------------------------------------------------|
| v0.3    | 3-5 new targets, `.gitignore` command, `.gitattributes`, `--json` flag |
| v0.4    | Global mode, Homebrew + single binary, JSON Schema                     |
| v0.5    | Programmatic API, MCP server, `convert` command                        |
| v0.6    | Plugin system, ephemeral generation, community registry MVP            |
| v0.7    | `migrate` command, IDE extension, registry discovery                   |

---

## Priority by Goal

**Adoption:** More targets > Distribution > Global mode > `migrate`

**Differentiation:** `.gitattributes` > Plugin system > MCP server > Ephemeral mode

**Team/Enterprise:** Programmatic API > `--json` output > JSON Schema > Community registry
