---
'agentsmesh': minor
---

**Eleven capability gaps closed across Continue, Amazon Q and Warp — plus three defects found along the way that were losing user data.**

**Continue: agents and hooks are now generated at both scopes.** Agents are `.continue/agents/<name>.md` — Markdown with `name`/`description`/`model`/`tools` frontmatter, where `tools` and `rules` are comma-separated strings because upstream types them as `z.string()` and rejects the whole file on a YAML list. Hooks are the `hooks` key of `.continue/settings.json`, reusing the Claude Code serializer since Continue's loader documents the same 17 event names and the same file shape. `.continue/agents/*.yaml` assistant profiles are treated as user-owned: never written, never imported, never deleted.

**Amazon Q: ignore and global rules now reach the agent.** Ignore patterns become `toolsSettings.fs_read.deniedPaths` / `fs_write.deniedPaths` in the agent JSON — Q CLI has no ignore file anywhere. Global rule files are still written to `~/.aws/amazonq/rules/`, but Q CLI never reads that directory on its own (`paths.rs` `mod global` has no rules constant), so the generated agent JSON now carries a `file://~/.aws/amazonq/rules/**/*.md` glob in its `resources` array — that entry is what makes the files reachable. `rules` at global scope is therefore honestly `embedded` rather than `native`.

**Warp: project ignore, global rules and global permissions.** `.warpindexingignore`, `~/.agents/AGENTS.md`, and the four `[agents.profiles]` keys in `~/.warp/settings.toml`, merged key-scoped so unrelated settings survive.

Three fixes to behaviour that was already shipping:

- **Every generated Amazon Q agent was silently dropping your project rules.** Q's `Agent` struct declares `resources` with `#[serde(default)]`, so a custom agent inherits nothing from the built-in default agent — including its `.amazonq/rules/**/*.md` glob and the `AGENTS.md` / `README.md` / `AmazonQ.md` documentation resources. Running `q chat --agent <name>` saw none of them. Generated agents now carry full default-agent parity.
- **Warp permission revocation was a no-op.** Removing an entry from `permissions.yaml` left the old allowlist in `settings.toml`, so a revoked `Bash(curl:*)` kept auto-running. agentsmesh now owns those four keys outright and rewrites them on every emit.
- **Warp's regexes were being escaped into dead literals.** Warp's allow/denylists are regexes, so `import --global` followed by `generate --global` turned a user's `rm -rf .*` deny rule into `rm -rf \.\*`, which matches nothing. Payloads now round-trip verbatim; allowlist entries are anchored `^…$` and denylist entries left unanchored, each taking the narrower reading of Warp's undocumented match semantics so no rule can come back weaker.

Amazon Q's embedded features (hooks, permissions, ignore) are now gated on their own `features` entries via `emitScopedSettings`, so disabling a feature no longer leaks it into the agent JSON. Amazon Q import merges into `.agentsmesh/ignore` instead of overwriting it, preserving comments and `!` negations that Q cannot express, and Warp import preserves canonical `ask` plus entries Warp has no key for.
