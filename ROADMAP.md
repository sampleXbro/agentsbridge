# AgentsMesh Roadmap

Based on community feedback, GitHub issue analysis, and AgentsMesh's existing strengths.

## Principles

- Close gaps that block adoption before adding novel features.
- Leverage existing advantages (permissions, lock files, diff, lint, watch, local overrides) that users are actively requesting.
- Prioritize features by community demand signal (reactions, comments, recurring requests).
- Reduce daily friction, not just configuration complexity.

## Shipped

| Feature                        | Status   | Notes                                          |
| ------------------------------ | -------- | ---------------------------------------------- |
| Permissions syncing            | Shipped  | Frequently requested, rarely available         |
| Lock file + merge              | Shipped  | Not available in most tools                    |
| `diff` command                 | Shipped  | Most tools only offer `--dry-run` on generate  |
| `lint` command                 | Shipped  | Not available in most tools                    |
| `watch` mode                   | Shipped  | Not available in most tools                    |
| Local overrides (`local.yaml`) | Shipped  | Frequently requested                           |
| Link rebasing                  | Shipped  | Frequently requested                           |
| `matrix` command               | Shipped  | Not available in most tools                    |
| 11 targets                     | Shipped  | Claude Code, Cursor, Copilot, Gemini CLI, Cline, Codex CLI, Windsurf, Continue, Junie, Antigravity, Roo Code |
| Community catalog (website)    | Shipped  | Skills, agents, commands explorer on homepage  |
| Pack install + sync            | Shipped  | `install`, `install --sync`, `installs.yaml`   |

---

## Tier 1: Close the Gaps (Must-Have)

### 1. More Agent Targets

11 tools is good. Breadth remains one of the biggest adoption drivers. The AI coding tool space is growing fast.

Priority targets based on community demand:

- **Kiro** (Amazon's new AI IDE — already drawing attention)
- **Goose** (Block's open-source agent, developer-friendly)
- **OpenCode** (terminal-first, growing community)
- **Kilo Code** (Cline fork, distinct config surface)
- **Factory Droid** (enterprise-focused agent)
- **Amp** (new entrant, getting traction)

### 2. Global Mode

User-level configs across all projects. One of the most-voted feature requests across the AI config tooling community. Expands AgentsMesh from project-scoped to personal developer workflow.

Goals:

- Support personal/global rules outside a single repo (`~/.agentsmesh/`)
- Define merge precedence between global and project-local config
- Cover tools that have native global support (Claude Code, Codex CLI, Gemini CLI, etc.)

### 3. Plugin System for Custom Targets

Let users add custom targets without forking. The highest-leverage adoption feature for a sync library — it makes every niche AI tool compatible without core PRs.

Goals:

- Define a stable target plugin interface
- `agentsmesh plugin add ./my-custom-target`
- Community-contributed targets ship independently of the core release cycle
- Plugin registry page on the website

### 4. Distribution: Homebrew + Single Binary

Most developers expect `brew install agentsmesh` and a standalone binary. AgentsMesh currently requires Node.js >=20.

Goals:

- Publish Homebrew formula
- Ship Node.js SEA (Single Executable Application) binary
- Remove Node.js as a prerequisite for non-JS developers

### 5. JSON Schema for Config Files

Provide schema files for IDE autocomplete and validation. Extremely high ROI — zero extra tooling needed by users, big reduction in config errors.

Goals:

- Publish JSON Schema for `agentsmesh.yaml`
- Enable IntelliSense in VSCode, JetBrains, etc.
- Publish to SchemaStore so it works with zero user config

### 6. `--json` Flag on All Commands

Machine-readable output for scripting and CI pipelines.

Goals:

- Add `--json` to `generate`, `diff`, `lint`, `check`, `matrix`
- Structured output for programmatic consumption

---

## Tier 2: Differentiate (High Impact)

### 7. Community Registry — Full Publishing

The catalog MVP is live on the website. The next step is a full publish-and-discovery workflow so developers can share their own packs.

Goals:

- Submit a pack to the registry via PR or CLI (`agentsmesh publish`)
- Version pinning with changelog visibility in catalog
- Ratings, downloads, or star counts for social proof
- `agentsmesh install @registry/pack-name` shorthand

### 8. Programmatic API

Expose `import { generate, lint, diff } from 'agentsmesh'` for CI scripts, custom tooling, and automated pipelines.

Goals:

- Export core functions as a stable public API
- Enable CI/CD integration without CLI subprocess spawning
- Support IDE plugin development

### 9. MCP Server (Self-Serve)

Expose AgentsMesh as an MCP tool so AI agents can self-configure. Increasingly requested by teams building agentic workflows.

Goals:

- Implement MCP server with CRUD operations for rules, commands, agents
- Let agents introspect their own configuration
- Enable "AI configures AI" workflows

### 10. `.gitattributes` Auto-Generation

Mark generated files as `linguist-generated` to reduce PR noise and GitHub language statistics pollution.

Goals:

- Auto-generate `.gitattributes` entries for all generated config files
- Clean PR diffs — generated files collapse by default on GitHub

### 11. `.gitignore` Command

Auto-maintain `.gitignore` entries for generated AI config files.

Goals:

- `agentsmesh gitignore` to add/update entries
- Respect `--targets` and `--features` filters
- Idempotent — safe to run repeatedly

### 12. `convert` Command

Direct tool-to-tool conversion without going through canonical format. One of the oldest migration requests in the community.

Goals:

- `agentsmesh convert --from cursor --to claude-code`
- Useful for quick migrations without full canonical setup

---

## Tier 3: Win the Ecosystem

### 13. IDE Extension

VSCode / JetBrains plugin for visual config editing. High effort but the most visible differentiator for team adoption.

Goals:

- Visual compatibility matrix
- Config editing with autocomplete and JSON Schema
- One-click generate/diff/lint
- Status bar showing drift state

### 14. Ephemeral Mode

Generate configs temporarily without writing to the filesystem.

Goals:

- `agentsmesh generate --stdout` for piping
- `agentsmesh generate --temp` for Docker builds, CI, testing
- No persistent file writes

### 15. `migrate` Command

`agentsmesh migrate --from <tool>` — import existing AI config directories directly into `.agentsmesh/`. Different from `import`: opinionated, zero-friction, single-command.

Goals:

- Zero-friction migration from other tools
- Map existing config formats to `agentsmesh.yaml`
- Preserve all rules, commands, subagents, skills, MCP, hooks, ignore

---

## Known Failure Patterns to Prevent

These are common failure modes in AI config tooling, extracted from community bug reports and user feedback. AgentsMesh's design explicitly guards against them.

| Pattern                         | Prevention Strategy                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Import breaks on edge cases     | Exhaustive import testing: empty frontmatter, subdirectories, alternate file locations |
| Path separator issues (Windows) | Normalize all paths to POSIX; test on Windows CI                                       |
| Duplicate/conflicting outputs   | Validate output paths for cross-target collisions before writing                       |
| Global vs local scope confusion | Clear error messages + lint warnings when scope is ambiguous                           |
| Frontmatter validation          | Lint catches missing/malformed frontmatter before generate                             |
| Hook script path references     | Copy referenced hook scripts to target directories                                     |

---

## Suggested Release Order

### v0.3

- Global mode (`~/.agentsmesh/`)
- Homebrew + single binary distribution
- JSON Schema for config files (SchemaStore)
- 2–3 new targets (Kiro, Goose, OpenCode)

### v0.4

- Plugin system for custom targets
- `--json` flag on all commands
- Community registry — full publish workflow

### v0.5

- Programmatic API
- MCP server (self-serve)
- `convert` command
- `.gitattributes` auto-generation
- `.gitignore` command

### v0.6

- `migrate` command
- IDE extension (VSCode)
- Ephemeral generation mode
- Registry discovery and versioning

---

## Priority by Goal

### If the goal is adoption

1. More targets (especially Kiro, Goose)
2. Distribution (Homebrew/binary)
3. Plugin system (removes the ceiling on target coverage)
4. Global mode

### If the goal is differentiation

1. Plugin system (nobody in this space has this)
2. `.gitattributes` auto-generation (nobody has this)
3. MCP server for self-configuration
4. Full community registry with publishing

### If the goal is team/enterprise value

1. Programmatic API
2. `--json` output
3. JSON Schema for IDE support
4. `migrate` command (zero-friction onboarding)
