# AgentsMesh Roadmap

Current release: **v0.13.0** | 18 targets | Full docs at [samplexbro.github.io/agentsmesh](https://samplexbro.github.io/agentsmesh)

## Principles

1. Close gaps that block adoption before adding novel features.
2. Reduce daily friction, not just configuration complexity.
3. Prioritize by community demand signal — reactions, recurring requests, ecosystem pull.
4. Ship small, validate fast, iterate.

---

## What's Next

### P0 — Homebrew + Single Binary (Adoption Unlock)

**Why first:** AgentsMesh requires Node.js >= 20 today. Python/Go/Rust shops, data teams, and DevOps engineers can't use it without installing an entire runtime they don't otherwise need. This is the single largest adoption blocker. Every other feature benefits more users once this ships.

- Publish Homebrew formula (tap first, then homebrew-core submission)
- Ship Node.js SEA (Single Executable Application) binaries for macOS (arm64 + x64), Linux (x64 + arm64), Windows (x64)
- Wire release CI to build + upload binaries alongside npm publish
- Define plugin loading story for the binary path (npm-installed plugins vs sideloaded descriptors)

**Effort:** Medium | **Impact:** High — opens AgentsMesh to every developer, not just the JS ecosystem.

---

### P1 — `migrate` Command (Zero-Friction Onboarding)

**Why:** `convert` (shipped v0.12) handles quick tool-to-tool migrations without canonical setup. `migrate` is the "I'm going all-in" path — a single opinionated command that imports existing configs, scaffolds `agentsmesh.yaml`, and leaves you with a fully canonical project.

- `agentsmesh migrate --from <tool>` — one command, no questions
- Map existing config formats into `agentsmesh.yaml` targets/features
- Preserve all surfaces: rules, commands, agents, skills, MCP, hooks, ignore
- Interactive conflict resolution when importing from multiple overlapping sources

**Effort:** Medium | **Impact:** High — the lowest-friction path from "curious" to "adopted."

---

### P2 — `.gitattributes` + `.gitignore` Auto-Generation (PR Hygiene)

**Why:** Every `generate` run produces files that clutter PR diffs and skew GitHub language stats. Marking them `linguist-generated` collapses them by default. Nobody else in this space does this, and it's a small effort for immediate daily-use improvement.

#### `.gitattributes`
- Auto-generate entries for all generated config files after `generate`
- Generated files collapse by default in GitHub PR diffs
- Opt-in via `generate --gitattributes` or config flag

#### `.gitignore`
- `agentsmesh gitignore` to add/update entries for generated files
- Respect `--targets` and `--features` filters
- Idempotent — safe to run repeatedly

**Effort:** Low | **Impact:** Medium — polish that signals maturity.

---

### P3 — Ephemeral Mode (Docker + CI)

**Why:** Docker builds and CI pipelines want generated configs at build time without committing them to the repo. `--stdout` lets you pipe; `--temp` lets you mount into a container layer. Clean separation of "config source" from "config artifact."

- `agentsmesh generate --stdout` — emit to stdout for piping
- `agentsmesh generate --temp` — write to a temp directory, print the path
- No persistent file writes in either mode

**Effort:** Low | **Impact:** Medium — unlocks container and CI workflows.

---

### P4 — Skills Registry Publishing (Ecosystem Growth)

**Why:** Claude Code's skills ecosystem exploded in 2025-2026 and is the single biggest content surface AgentsMesh supports canonically. The catalog/website is live, pack install works — but there's no publish-and-discover workflow. This is how you build community and lock-in.

- Submit a pack/skill via PR or CLI (`agentsmesh publish`)
- Version pinning with changelog visibility
- Ratings, downloads, or star counts for social proof
- `agentsmesh install @registry/pack-name` shorthand
- Skill-level browsing (not just pack-level)

**Effort:** High | **Impact:** High — network effects, but depends on community critical mass.

---

### P5 — IDE Extension (Team Visibility)

**Why:** Most developers live in their editor. A VS Code extension (JetBrains follow-up) makes AgentsMesh visible without the terminal. The programmatic API (v0.6) and `--json` (v0.12) provide the foundation.

- Visual compatibility matrix
- Config editing with autocomplete (supplements JSON Schema with richer UX)
- One-click generate / diff / lint
- Status bar showing drift state
- Skills browser integrated with community catalog

**Effort:** High | **Impact:** High — most visible differentiator for team adoption.

---

### P6 — Team/Remote Config Layer (Enterprise)

**Why:** Beyond project-local and user-global: organizations need a team-level config layer pulled from a remote source. Emerging ask as AgentsMesh gets used inside companies.

- `agentsmesh.yaml` supports `extends: <remote>` (Git URL, HTTP, or registry pack)
- Signed/pinned remote sources (hash or tag)
- Cache + offline fallback
- Clear precedence: team → user (`~/.agentsmesh`) → project → `local.yaml`

**Effort:** High | **Impact:** Medium — enterprise play, not yet blocking individual adoption.

---

### Backlog

| Item | Notes |
| --- | --- |
| Factory Droid target | Enterprise-focused; ship as plugin unless demand justifies core |
| Cody target (Sourcegraph) | Evaluate overlap with Amp before committing |
| Config linting as a service | Hosted lint endpoint for restricted CI runners — only if real demand materializes |
| Programmatic API semver freeze | Typed surface shipped in v0.6; formal stability pledge deferred to v1.0 |

---

## Suggested Release Order

| Release | Scope |
| --- | --- |
| **v0.14** | `.gitattributes` + `.gitignore` auto-generation (P2), ephemeral mode (P3) |
| **v0.15** | `migrate` command (P1) |
| **v0.16** | Homebrew formula + SEA binaries (P0) |
| **v1.0** | Skills registry publishing (P4), API semver freeze, stability guarantees |
| **v1.x** | IDE extension (P5), team/remote config (P6) |

> P0 is the highest-priority item but has the longest lead time (CI matrix, binary signing, Homebrew submission). Ship P2 and P3 first — they're quick wins that land while distribution work is in progress.

---

## What's Shipped

For full details on any shipped feature, see the [changelog](../CHANGELOG.md).

| Feature | Version | Highlight |
| --- | --- | --- |
| Permissions syncing, lock file, diff, lint, watch, local overrides, link rebasing, matrix | Early | Core workflow — none of these existed in competing tools |
| Broad target coverage (18 targets) | Ongoing | Claude Code, Cursor, Copilot, Codex CLI, Gemini CLI, Windsurf, Continue, Cline, Kiro, Roo Code, Junie, Antigravity, Kilo Code, OpenCode, Goose, Amp, Zed, Warp |
| Community catalog (website) | Early | Skills, agents, commands explorer |
| Pack install + sync | Early | `install`, `install --sync`, `installs.yaml` |
| JSON Schema for all config | v0.5 | Zero-config IDE validation |
| Global mode (all targets) | v0.5 | `--global`, `~/.agentsmesh/`, full round-trip |
| Target scaffolder | v0.6 | `agentsmesh target scaffold <id>` |
| Plugin system MVP | v0.6 | `plugin add/list/remove/info`, runtime descriptor validation |
| Programmatic API | v0.6 | Typed entrypoints, full functional surface, integration tests |
| Native Windows support | v0.6.1 | CI gates `windows-latest`, POSIX path normalization |
| `--json` flag on all commands | v0.12 | Machine-readable JSON envelope, CI/IDE/MCP-ready |
| `convert` command | v0.12 | `agentsmesh convert --from cursor --to claude-code` |
| MCP server (self-serve) | v0.13 | 41 tools + 16 resources, seeded on `init` |

---

## Known Failure Patterns

Common failure modes in AI config tooling. AgentsMesh guards against each explicitly.

| Pattern | Prevention |
| --- | --- |
| Import breaks on edge cases | Exhaustive import testing: empty frontmatter, subdirectories, alternate file locations |
| Path separator issues (Windows) | Normalize all paths to POSIX; test on Windows CI |
| Duplicate/conflicting outputs | Validate output paths for cross-target collisions before writing |
| Global vs local scope confusion | Scope-aware errors, `~/`-prefixed log paths in global mode, ambiguous-scope lint warnings |
| Frontmatter validation | Lint catches missing/malformed frontmatter before generate |
| Hook script path references | Copy referenced hook scripts to target directories |
| Stale roadmap vs ship state | Every release updates this doc before tagging |
