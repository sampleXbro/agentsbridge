---
'agentsmesh': patch
---

Stop replacing and deleting the config files the AI tools write themselves

Twenty-two generated paths were written from canonical alone AND listed in
`managedOutputs.files`, the stale-cleanup delete list. Every run replaced the
whole document — losing every key the tool or the user had put there — and any
run that stopped emitting the path deleted the file outright.

Confirmed end to end: a `~/.codeium/windsurf/mcp_config.json` holding a server
added in Windsurf's MCP UI plus an unrelated top-level key came back with both
gone.

Each path now has a key-scoped merge hook and moved to
`managedOutputs.coOwnedFiles`, which cleanup never reads:

- **MCP configs** (`mcpServers` and the canonical per-server fields owned;
  `disabled`, `autoApprove`, `timeout`, `cwd` and every other top-level key
  carried over): amazon-q `.amazonq/mcp.json` + `~/.aws/amazonq/mcp.json`,
  cline `.cline/mcp.json`, codebuff `.agents/mcp.json`, cursor
  `.cursor/mcp.json`, factory-droid `.factory/mcp.json`, junie
  `.junie/mcp/mcp.json`, kilo-code `.kilo/mcp.json`, kimi-code
  `.kimi-code/mcp.json`, kiro `.kiro/settings/mcp.json`, roo-code
  `.roo/mcp.json`, rovodev `~/.rovodev/mcp_config.json`, trae `.trae/mcp.json`,
  warp `.warp/.mcp.json`, windsurf `~/.codeium/windsurf/mcp_config.json`.
- **Hooks configs**: antigravity `.agents/hooks.json` +
  `~/.gemini/config/hooks.json` (keyed by user-chosen handler names, so the
  user's handlers now survive), codex-cli `.codex/hooks.json` (keeps the
  top-level `description`), cursor `.cursor/hooks.json`, factory-droid
  `.factory/hooks.json`, trae `.trae/hooks.json` + `~/.trae-cn/hooks.json`,
  windsurf `.windsurf/hooks.json` + `~/.codeium/windsurf/hooks.json`.
- **Permissions and settings**: cursor `.cursor/cli.json` /
  `~/.cursor/cli-config.json` (keeps `version`, `editor`, `network`),
  factory-droid `.factory/settings.json` (agentsmesh owns only
  `commandAllowlist` / `commandDenylist`), junie `~/.junie/allowlist.json`
  (agentsmesh owns only `rules.executables`, so "Always allow" approvals in the
  other categories, plus `defaultBehavior` and `allowReadonlyCommands`,
  survive).
- **Agents manifest**: cline `.cline/agents.yaml`, merged on the `agents` key.

A new repo-wide invariant makes the class impossible to reintroduce silently:
any structured config document (JSON/JSONC/TOML/YAML) left in
`managedOutputs.files` must be named in an explicit, justified allowlist of the
outputs agentsmesh owns outright. It runs over registered plugin descriptors as
well as builtins.

Paths deliberately unchanged because agentsmesh owns them end to end:
`.continue/mcpServers/agentsmesh.json`, `.github/hooks/agentsmesh.json`,
`.agents/plugins/agentsmesh/**`, `~/mcp_settings.json` (roo-code),
`.windsurf/mcp_config.example.json`, `~/.claude/hooks.json` (eviction entry) and
`.rovodev/prompts.yml`.

**Two fixes made while verifying this sweep.**

`mergeMcpServersJson` replaced the whole file when it could not parse the base,
so a comment in an MCP config destroyed it — the same fail-open that
`preservedUnparsableBase` was written to close, in a helper that never routed
through it. It now preserves an unparsable base, and this sweep would otherwise
have applied the destructive path to roughly twenty more files.

`.rovodev/prompts.yml` had been classified as agentsmesh-owned. It is not: the
importer reads it (`src/targets/rovodev/importer.ts`), which is the proof the
user authors prompts there. It now merges per entry by the same marker
convention Roo Code's custom modes use, and the marker algorithm — including
the fix for the first list entry, whose comment YAML reattaches to the sequence
node on re-parse — now lives once in `src/core/generate/yaml-list-merge.ts`
instead of being duplicated per target.

**Known gaps, unchanged by this release.** Managed *directories* have the same
problem `managedOutputs.files` had: the sweep deletes every file under a managed
dir that the run did not emit, so a hook or prompt file the tool or user created
in `.kiro/hooks`, `.cline/hooks` or `.rovodev/commands` is still removed. And a
server you added in a tool's own UI and never imported is still revoked, because
agentsmesh owns the whole `mcpServers` key and cannot tell your server from one
it wrote itself.

