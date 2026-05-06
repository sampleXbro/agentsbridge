# AgentsMesh Roadmap

Based on community feedback, GitHub issue analysis, ecosystem demand signals, and AgentsMesh's existing strengths.

Current release: **v0.6.0**

## Principles

- Close gaps that block adoption before adding novel features.
- Leverage existing advantages (permissions, lock files, diff, lint, watch, local overrides) that users are actively requesting.
- Prioritize features by community demand signal (reactions, comments, recurring requests in the wider AI-config tooling ecosystem).
- Reduce daily friction, not just configuration complexity.

## Shipped

| Feature                             | Version | Notes                                                                                                             |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| Permissions syncing                 | Early   | Frequently requested, rarely available                                                                            |
| Lock file + merge                   | Early   | Not available in most tools                                                                                       |
| `diff` command                      | Early   | Most tools only offer `--dry-run` on generate                                                                     |
| `lint` command                      | Early   | Not available in most tools                                                                                       |
| `watch` mode                        | Early   | Not available in most tools                                                                                       |
| Local overrides (`local.yaml`)      | Early   | Frequently requested                                                                                              |
| Link rebasing                       | Early   | Frequently requested                                                                                              |
| `matrix` command                    | Early   | Not available in most tools                                                                                       |
| Broad target coverage (18 targets)  | Ongoing | See [supported tools matrix](https://samplexbro.github.io/agentsmesh/reference/supported-tools/) for the full list |
| Community catalog (website)         | Shipped | Skills, agents, commands explorer on homepage                                                                     |
| Pack install + sync                 | Shipped | `install`, `install --sync`, `installs.yaml`                                                                      |
| **Kiro target**                     | v0.3    | Native `AGENTS.md`, steering, skills, hooks, MCP, `.kiroignore`                                                   |
| **JSON Schema for all config**      | v0.5    | `agentsmesh.yaml`, `local.yaml`, `permissions.yaml`, `hooks.yaml`, `mcp.json`, `pack.yaml` — zero-config in IDEs  |
| **`$schema` comment on init**       | v0.5    | IDE validation active out of the box                                                                              |
| **Global mode (all 12 targets)**    | v0.5    | `--global`, canonical `~/.agentsmesh/`, per-target `descriptor.global`, full import + generate round-trip         |
| **Roo Code agents → custom modes**  | v0.5    | `.roomodes` / `settings/custom_modes.yaml`                                                                        |
| **Cline global hooks round-trip**   | v0.5    | Embedded `# agentsmesh-event:` metadata                                                                           |
| **Target Scaffolder**               | v0.6    | `agentsmesh target scaffold <id>` — 10-file skeleton, tests, fixture, post-steps                                   |
| **Plugin System MVP**               | v0.6    | `agentsmesh plugin add/list/remove/info`, runtime descriptor validation, `plugins`/`pluginTargets` config fields   |
| **Global mode hardening**           | v0.6    | Boot-time `sharedArtifacts` ownership guard; scope-aware error when `~/.agentsmesh/agentsmesh.yaml` is missing on any `--global` command; cross-process race coverage for the generate lock; engine-level Copilot dual-mirror assertions |
| **Programmatic API (complete)**     | v0.6    | Typed entrypoints (`agentsmesh`, `agentsmesh/engine`, `agentsmesh/canonical`, `agentsmesh/targets`); full functional surface (`loadConfig`, `loadCanonical`, `generate`, `importFrom`, `lint`, `diff`, `check`, `computeDiff`, `formatDiffSummary`, `registerTargetDescriptor`, catalog inspection); typed error taxonomy + canonical + target-descriptor types; comprehensive integration test (21 cases) + dist-backed consumer-smoke type contract; README + dedicated website reference page. Semver freeze deferred to v1.0 |
| **Native Windows support**          | v0.6.1  | npm install no longer blocks Windows; CI gates `windows-latest` on Node 22; local install/pack provenance persists POSIX paths; integration helpers resolve Windows `.cmd` shims |
| **Kilo Code target**                | v0.8    | Native `AGENTS.md`, rules, commands, agents (subagents), skills, MCP, `.kilocodeignore`                            |
| **OpenCode target**                 | v0.9    | Native `AGENTS.md`, rules, commands, agents, skills, MCP via `opencode.json`                                       |
| **Goose target**                    | v0.10   | Native `.goosehints` (root + embedded rules), skills (`.agents/skills/`), `.gooseignore`                            |
| **Amp target**                      | v0.11   | Native `AGENTS.md`, `.agents/skills/`, `.amp/settings.json` MCP, commands/agents → skills                          |
| **Zed target**                      | v0.11   | Native `.rules` (root + embedded), `.zed/settings.json` MCP                                                        |
| **Warp target**                     | v0.11   | Native `AGENTS.md` (legacy `WARP.md`), `.warp/skills/`, `.mcp.json`, commands/agents → skills, global skills only   |
| **`--json` flag on all commands**   | v0.12   | Machine-readable JSON envelope on every command; muted human output; `watch` rejected; CI/IDE/MCP-ready              |
| **`convert` command**              | v0.12   | `agentsmesh convert --from <source> --to <target>` — direct tool-to-tool conversion via temp-dir import→generate pipeline; `--dry-run`, `--json`, `--global` support |

---

## v0.6.1: Windows + Extensibility Follow-up

- Native Windows support: remove the npm `os` allowlist, run the quality suite on `windows-latest` with Node 22, persist local install/pack paths as POSIX in `installs.yaml` and `pack.yaml`, resolve `.bin/*.cmd` shims in integration helpers, and keep `file:` plugin imports on `fileURLToPath`.
- Wire `agentsmesh import --from <plugin-target>` for plugin-provided targets
- Remove remaining hardcoded target-name references in shared lint and check paths
- Plugin registry/discovery page on the website
- SEA (single-binary) + dynamic plugin loading compatibility

## Tier 1: Close the Gaps (Must-Have)

**Sequencing note:** the first two items form one dependency chain — **scaffolder → plugin system → target batch**. With scaffolder and plugin system landed in v0.6, subsequent targets become scoped, out-of-core changes.

### 1. More Agent Targets

18 targets is solid; breadth remains one of the biggest adoption drivers, and the AI coding tool space kept growing through 2025–2026. With the scaffolder and plugin system in place, targets become drop-in descriptor modules — we ship the high-demand ones in core, leave the long tail to the community.

**Shipped:** Kilo Code (v0.8), OpenCode (v0.9), Goose (v0.10) — first wave complete. Amp, Zed, Warp (v0.11) — second wave complete.

Priority targets, re-ranked by current demand signal:

- ~~**Amp** (Sourcegraph)~~ — shipped v0.11.
- ~~**Zed AI**~~ — shipped v0.11.
- ~~**Warp** (Warp Agent Mode)~~ — shipped v0.11.
- **Factory Droid** — enterprise-focused; lower individual demand but high deal value.
- **Cody** (Sourcegraph, if distinct from Amp's surface) — evaluate post-Amp.

**Landing order:** Second wave complete. Factory Droid and Cody as plugins unless demand justifies core.

### 4. Distribution: Homebrew + Single Binary

Most developers expect `brew install agentsmesh` and a standalone binary. AgentsMesh currently requires Node.js >=20, which is a hard blocker for non-JS developers (Python/Go/Rust shops, data teams, DevOps). Highest adoption-unlock per unit of effort outside the extensibility chain.

Goals:

- Publish Homebrew formula (tap first, then homebrew-core)
- Ship Node.js SEA (Single Executable Application) binaries for macOS (arm64 + x64), Linux (x64 + arm64), Windows (x64)
- Remove Node.js as a prerequisite for non-JS developers
- Wire release CI to produce + upload binaries alongside npm publish
- Note: SEA + plugin system interact — plan plugin loading for the binary path (npm-installed plugins vs. sideloaded descriptor files)

### ~~5. `--json` Flag on All Commands~~ — Shipped v0.12

Machine-readable output for scripting, CI pipelines, and IDE extension integration.

Shipped:

- `--json` global flag on all 12 commands (init, generate, import, diff, lint, check, merge, matrix, install, plugin, target; `watch` rejected)
- Envelope contract: `{ success, command, data?, error? }` — single line to stdout, human output fully suppressed
- Structured per-command data payloads with typed interfaces
- Nonzero exit codes preserved; `CliUsageError` → exit 2; all others → exit 1
- `--json` implies `--force` for install (no interactive prompts in machine mode)
- Logger muting ensures zero leakage to stdout/stderr in JSON mode

### ~~7. `convert` Command~~ — Shipped v0.12

Direct tool-to-tool conversion without going through canonical setup. One of the oldest migration requests in the community and the lowest-friction way for skeptics to try AgentsMesh.

Shipped:

- `agentsmesh convert --from cursor --to claude-code`
- Quick migrations without full canonical setup — no `.agentsmesh/` directory created
- Internally powered by existing import → generate pipeline via temporary directory with symlinks
- Works across core targets and plugin-provided targets uniformly
- `--dry-run`, `--json`, and `--global` flags supported
- Temp dir filtered to dot-entries only to prevent home-directory traversal hangs

---

## Tier 2: Differentiate (High Impact)

### 7. Skills Registry — Full Publishing

Claude Code's skills ecosystem exploded in 2025–2026 and is the single biggest content surface AgentsMesh already supports canonically. The catalog MVP is live; the next step is a full publish-and-discovery workflow.

Goals:

- Submit a pack/skill to the registry via PR or CLI (`agentsmesh publish`)
- Version pinning with changelog visibility in catalog
- Ratings, downloads, or star counts for social proof
- `agentsmesh install @registry/pack-name` shorthand
- Skill-level browsing (not just pack-level) to match how Claude Code skills are discovered today

### 8. MCP Server (Self-Serve)

Expose AgentsMesh as an MCP tool so AI agents can self-configure. Demand is meaningfully higher than it was 12 months ago — teams building agentic workflows ask for this regularly, and it pairs naturally with the Programmatic API.

Goals:

- Implement MCP server with CRUD operations for rules, commands, agents, skills
- Let agents introspect their own configuration
- Enable "AI configures AI" workflows
- Ships as a separate entry point; built on the Programmatic API shipped in v0.6

### 9. `migrate` Command

`agentsmesh migrate --from <tool>` — import existing AI config directories directly into `.agentsmesh/` in a single opinionated step. Distinct from `import`: zero-friction, single-command, no questions asked.

Goals:

- Zero-friction migration from other tools
- Map existing config formats to `agentsmesh.yaml`
- Preserve all rules, commands, subagents, skills, MCP, hooks, ignore
- Interactive conflict resolution for overlapping sources

### 10. `.gitattributes` Auto-Generation

Mark generated files as `linguist-generated` to reduce PR noise and GitHub language statistics pollution. Nobody else in this space does this.

Goals:

- Auto-generate `.gitattributes` entries for all generated config files
- Clean PR diffs — generated files collapse by default on GitHub
- Opt-in flag on `generate` or dedicated `gitattributes` subcommand

### 11. `gitignore` Command

Auto-maintain `.gitignore` entries for generated AI config files.

Goals:

- `agentsmesh gitignore` to add/update entries
- Respect `--targets` and `--features` filters
- Idempotent — safe to run repeatedly

### 12. Ephemeral Mode

Generate configs temporarily without writing to the filesystem. Useful for Docker builds, CI, and piping.

Goals:

- `agentsmesh generate --stdout` for piping
- `agentsmesh generate --temp` for Docker builds, CI, testing
- No persistent file writes

---

## Tier 3: Win the Ecosystem

### 13. IDE Extension

VSCode / JetBrains plugin for visual config editing. High effort but the most visible differentiator for team adoption. Programmatic API shipped in v0.6; `--json` shipped in v0.12 — no remaining blockers on the CLI side.

Goals:

- Visual compatibility matrix
- Config editing with autocomplete (already possible via JSON Schema — extension adds richer UX)
- One-click generate / diff / lint
- Status bar showing drift state
- Skills browser integrated with community registry

### 14. Team/Remote Config Layer

Beyond project-local and user-global: a team-level config layer pulled from a remote source (Git URL, HTTP, or registry pack), merged with project and user configs. Emerging ask as AgentsMesh gets used inside organizations.

Goals:

- `agentsmesh.yaml` supports `extends: <remote>`
- Signed/pinned remote sources (hash or tag)
- Cache + offline fallback
- Clear precedence: team → user (`~/.agentsmesh`) → project → `local.yaml`

### 15. Config Linting as a Service

A hosted lint endpoint that CI can hit without installing AgentsMesh, for teams on restricted runners. Low priority; include only if real demand materializes.

---

## Known Failure Patterns to Prevent

These are common failure modes in AI config tooling, extracted from community bug reports and user feedback. AgentsMesh's design explicitly guards against them.

| Pattern                         | Prevention Strategy                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Import breaks on edge cases     | Exhaustive import testing: empty frontmatter, subdirectories, alternate file locations |
| Path separator issues (Windows) | Normalize all paths to POSIX; test on Windows CI                                       |
| Duplicate/conflicting outputs   | Validate output paths for cross-target collisions before writing                       |
| Global vs local scope confusion | Scope-aware error on `--global` when `~/.agentsmesh/agentsmesh.yaml` is missing (v0.6); `~/`-prefixed log paths in global mode (v0.6); ambiguous-scope lint warnings (planned) |
| Frontmatter validation          | Lint catches missing/malformed frontmatter before generate                             |
| Hook script path references     | Copy referenced hook scripts to target directories                                     |
| Stale roadmap vs. ship state    | Every release updates this doc's Shipped table before tagging                          |

---

## Suggested Release Order

### v0.6 — Extensibility Foundation

- **Target scaffolder** (`agentsmesh target scaffold <id>`) — descriptor-driven, generates all 9 code files + fixtures + test stubs
- **Plugin system for custom targets** — stable `TargetDescriptor` interface, `plugin add/list/remove/info`, npm + local-path sources
- Internal dogfooding: rebuild one existing target (e.g. Kiro) through the scaffolder and validate zero-diff output

### v0.7–v0.10 — First Target Wave (Shipped)

- **Kilo Code** (v0.8) — validated scaffolder + plugin contract on a real Cline-family target
- **OpenCode** (v0.9) — terminal-first validation
- **Goose** (v0.10) — Block's agent, broad OSS appeal

### v0.11 — Second Target Wave + Distribution (Targets Shipped)

- ~~**Amp** + **Zed AI** + **Warp** targets~~ — shipped
- Homebrew formula + SEA binaries (macOS/Linux/Windows), with plugin-loading story defined for the binary path
- ~~`--json` flag on all commands~~ — shipped v0.12
- Semver-freeze the Programmatic API surface (entrypoints, types, and reference docs already shipped in v0.6 — only the formal pre-1.0 → 1.0 stability pledge remains)

### v0.9 — Migration, Registry, Agentic Use

- ~~`convert` command~~ — shipped v0.12
- `migrate` command
- `.gitattributes` auto-generation + `gitignore` command
- Skills/pack registry — full publish workflow, ratings, versioning
- MCP server (self-serve)
- `agentsmesh install @registry/...` shorthand

### v1.0 — Polish & Integration

- IDE extension (VS Code first, JetBrains follow-up)
- Team/remote config layer (`extends:`)
- Ephemeral generation mode (`--stdout`, `--temp`)
- Stability guarantees on all public APIs and the plugin interface

---

## Priority by Goal

### If the goal is adoption

1. ~~Scaffolder + Plugin system~~ (shipped v0.6)
2. ~~Kilo Code + OpenCode + Goose targets~~ (shipped v0.8–v0.10)
3. Distribution (Homebrew/binary) — largest untapped audience
4. ~~`convert`~~ (shipped v0.12) / `migrate` commands (zero-friction onboarding)

### If the goal is differentiation

1. Plugin system (nobody in this space has this)
2. Target scaffolder (nobody in this space has this either)
3. `.gitattributes` auto-generation (nobody has this)
4. MCP server for self-configuration
5. Full community registry with publishing (skills-first)

### If the goal is team/enterprise value

1. ~~`--json` output~~ (shipped v0.12; Programmatic API already enables CI integration since v0.6)
2. Team/remote config layer (`extends:`)
3. `migrate` command (zero-friction onboarding)
4. IDE extension (visible team-wide)
