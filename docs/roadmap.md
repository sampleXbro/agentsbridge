# AgentsMesh Roadmap

Current release: **v0.15.0** | Next: **v0.16.0 (security hardening)** | 24 targets (target: 35) | Full docs at [samplexbro.github.io/agentsmesh](https://samplexbro.github.io/agentsmesh)

## Principles

1. Close gaps that block adoption before adding novel features.
2. Reduce daily friction, not just configuration complexity.
3. Prioritize by community demand signal — reactions, recurring requests, ecosystem pull.
4. Ship small, validate fast, iterate.

---

## What's Next

### P0 — Catalog Coverage Parity (Close Tool-Count Gap)

**Why:** Competitor catalogs are larger — [rulesync](https://github.com/dyoshikawa/rulesync) supports ~27 tools and [ruler](https://github.com/intellectronica/ruler) supports ~30; AgentsMesh ships 18. Catalog reach drives "does it support X" evaluation gating, SEO, and inbound funnel — the documented #1 closeable competitive weakness in [`market-analysis-2026-05.md`](marketing/market-analysis-2026-05.md). Each missing target lands as a descriptor + fixtures via the `add-agent-target` skill — no core changes required. Closing this gap is the highest-leverage move for category leadership before mindshare consolidates around competitors.

**Tier A — high-demand, ship first (6 tools):**

- **Amazon Q Developer** — `.amazonq/rules/*.md`; broad enterprise install base
- **Aider** — `.aider.conf.yml` + `CONVENTIONS.md`; popular OSS terminal agent
- **AugmentCode** — `.augment/` rules + skills; established commercial tool with active dev
- **Trae** — ByteDance IDE; growing share in APAC and globally
- **Crush** — Charm.sh terminal coding agent
- **Qwen Code** — Alibaba CLI; Qwen3 ecosystem

**Tier B — fill out coverage (6 tools):**

- **Factory Droid** — promoted from backlog; enterprise-focused, evaluate plugin-vs-core
- **Replit Agent** — Replit Ghostwriter / Agent rules
- **Pi Coding Agent** — referenced by both rulesync and ruler
- **Jules** — Google asynchronous coding agent
- **Rovodev** — Atlassian agent
- **deepagents-cli**

**Tier C — research before committing (5 tools):**

- **OpenHands** (formerly OpenDevin)
- **Firebase Studio** — Google web IDE
- **Mistral Vibe** — Mistral coding agent
- **Firebender** — JetBrains-focused agent
- **Takt**

**Process per target (use the `add-agent-target` skill):** descriptor → fixtures → import + reference rewrite → project-mode + global-mode → matrix entry → docs entry → integration test. Ship 2-3 targets per release.

**Effort:** Medium per target (existing scaffolder + `add-agent-target` skill); Large in aggregate (17 tools). | **Impact:** **Highest** — only structural fix for the documented competitive gap. Drives SEO, evaluation pass-through, and validates the descriptor-driven plugin architecture under real load.

---

### P1 — `migrate` Command (Zero-Friction Onboarding)

**Why:** `convert` (shipped v0.13) handles quick tool-to-tool migrations without canonical setup. `migrate` is the "I'm going all-in" path — a single opinionated command that imports existing configs, scaffolds `agentsmesh.yaml`, and leaves you with a fully canonical project.

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

**Why:** Most developers live in their editor. A VS Code extension (JetBrains follow-up) makes AgentsMesh visible without the terminal. The programmatic API (v0.6) and `--json` (v0.13) provide the foundation.

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
| Cody target (Sourcegraph) | Evaluate overlap with Amp before committing |
| Config linting as a service | Hosted lint endpoint for restricted CI runners — only if real demand materializes |
| Programmatic API semver freeze | Typed surface shipped in v0.6; formal stability pledge deferred to v1.0 |
| Process-lock cross-host policy (F2) | Today the lock evicts foreign-hostname holders unconditionally, which breaks mutual exclusion on NFS/SMB shared volumes. Pick a lane: document as project-local only, or add an opt-in shared-volume mode. Deferred from v0.16 hardening — needs maintainer call. |
| Opt-in `file://` rebaser neutralization (L4) | Generated artifacts currently pass `file://` URIs through verbatim by design (preserved-scheme contract with explicit tests). Add a `neutralizeFileUris` flag plus a lint warning so users who don't want local-path links in committed output can opt in. Deferred from v0.16 hardening — contract change with existing test coverage. |

---

## Suggested Release Order

| Release | Scope |
| --- | --- |
| **v0.16 (next)** | Security & robustness hardening pass — strict MCP write-tool input validation, `set -eu` + `0o755` on generated hook wrappers, 500 MiB tarball cap, dash-prefix git arg rejection, Windows-portable canonical-name validation, plugin strict mode |
| **v0.17** | Catalog parity batch 1 (P0 Tier A — AmazonQ, Aider, AugmentCode, Trae, Crush, Qwen Code) |
| **v0.18** | Catalog parity batch 2 (P0 Tier B — Factory Droid, Replit, Pi, Jules, Rovodev, deepagents-cli) + `migrate` command (P1) |
| **v0.19** | Catalog parity batch 3 (P0 Tier C, post-research subset) + `.gitattributes`/`.gitignore` auto-generation (P2) + ephemeral mode (P3) |
| **v1.0** | Skills registry publishing (P4), API semver freeze, stability guarantees |
| **v1.x** | IDE extension (P5), team/remote config (P6) |

> v0.16 is the changeset already in `.changeset/security-hardening.md`. After it ships, P0 (catalog parity) is the highest-leverage adoption unlock; ship 2–3 targets per release using the `add-agent-target` skill. P1 (`migrate`) lands alongside Tier B once the architecture is exercised under real catalog load.

---

## What's Shipped

For full details on any shipped feature, see the [changelog](../CHANGELOG.md).

| Feature | Version | Highlight |
| --- | --- | --- |
| Permissions syncing, lock file, diff, lint, watch, local overrides, link rebasing, matrix | Early | Core workflow — none of these existed in competing tools |
| Broad target coverage (24 targets) | Ongoing | Claude Code, Cursor, Copilot, Codex CLI, Gemini CLI, Windsurf, Continue, Cline, Kiro, Roo Code, Junie, Antigravity, Kilo Code, OpenCode, Goose, Amp, Zed, Warp, Aider, Amazon Q, Augment Code, Crush, Qwen Code, Trae |
| Community catalog (website) | Early | Skills, agents, commands explorer |
| Pack install + sync | Early | `install`, `install --sync`, `installs.yaml` |
| JSON Schema for all config | v0.5 | Zero-config IDE validation |
| Global mode (all targets) | v0.5 | `--global`, `~/.agentsmesh/`, full round-trip |
| Target scaffolder | v0.6 | `agentsmesh target scaffold <id>` |
| Plugin system MVP | v0.6 | `plugin add/list/remove/info`, runtime descriptor validation |
| Programmatic API | v0.6 | Typed entrypoints, full functional surface, integration tests |
| Native Windows support | v0.6.1 | CI gates `windows-latest`, POSIX path normalization |
| `--json` flag on all commands | v0.13 | Machine-readable JSON envelope, CI/IDE/MCP-ready |
| `convert` command | v0.13 | `agentsmesh convert --from cursor --to claude-code` |
| MCP server (self-serve) | v0.14 | 41 tools + 16 resources, seeded on `init` |
| Homebrew tap + standalone binaries | v0.15 | `brew install samplexbro/agentsmesh/agentsmesh` and Bun-compiled binaries for macOS/Linux/Windows; SHA256-verified installer at `releases/latest/download/install.sh`. Removes the Node.js prerequisite for Python/Go/Rust shops. |

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
| Windows-unsafe canonical filenames | Parsers reject Windows reserved devices (CON/AUX/NUL/COM1-9/LPT1-9), reserved chars, and trailing dot/space at parse time on every host (v0.16) |
| MCP write-tool RCE via shell-meta payloads | Strict Zod schemas reject shell metacharacters in `command`, embedded newlines in matchers, non-`http(s)` URLs, and unknown server fields before they reach `mcp.json` / `hooks.yaml` (v0.16) |
| Generated hook wrapper newline injection | Strip `\r\n` from event/matcher/command before embedding in the comment header; emit `set -eu` and mode `0o755` so wrappers fail fast and don't silently no-op (v0.16) |
| Remote tarball memory exhaustion | 500 MiB cap enforced via `Content-Length` + streaming byte counter; aborts mid-stream on oversized responses (v0.16) |
| Git option-injection (`--upload-pack=…`) | Refuse refs and clone URLs that begin with `-` before any `execFile('git', …)` invocation (v0.16) |
| Cache directory escape via `AGENTSMESH_CACHE` | Validate the env var is an absolute path that is not the filesystem root before any keyed `rm -rf` (v0.16) |
| Plugin failures silently shrinking the matrix | Per-plugin `strict: true` and `AGENTSMESH_STRICT_PLUGINS=1` escalate failed loads to a single combined error so CI fails loudly (v0.16) |
| Stale roadmap vs ship state | Every release updates this doc before tagging |
