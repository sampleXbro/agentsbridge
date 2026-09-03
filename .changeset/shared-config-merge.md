---
'agentsmesh': patch
---

**`generate` no longer replaces shared config files it only partly owns.**

`generateFeature` — the emission path for rules, commands, agents, skills, MCP and ignore — was the only one that never received a merge callback, so those six features wrote whole files. Where a target's MCP output lands in a config file the user also owns, generation replaced everything else in it.

The merge policy now lives in one module (`src/core/generate/merge-policy.ts`) used by every emission path, including the `mirrorGlobalPath` branch that previously pushed raw content with no merge at all. Key-scoped mergers were added for the files that had none:

- **codex-cli** `.codex/config.toml` — `model`, `model_providers`, `shell_environment_policy` and `projects` trust survive; only `[mcp_servers.*]` is rewritten. The merge is text-preserving, so comments and formatting are kept.
- **claude-code** `.mcp.json` and global `.claude.json` — agentsmesh owns `mcpServers`; the account, project and history state in `~/.claude.json` is left alone.
- **copilot** `.vscode/mcp.json` — owns `servers`, so the `inputs` array holding secret prompts survives.
- **deepagents-cli** `.mcp.json` — the same owned-key set as claude-code, which writes the same path.

Servers removed from canonical are still revoked: owned keys are replaced wholesale, never deep-merged.

Two safety rules came out of this and are now enforced by tests:

- **A file we cannot parse is preserved, not replaced.** A `.vscode/mcp.json` or `.qwen/settings.json` containing comments is left untouched rather than rewritten without them — the rule `src/targets/zed/layout.ts` already documented. Note the run reports this as "unchanged", so generated servers are silently not applied to a JSONC file.
- **Targets sharing an output path must own identical keys.** claude-code and deepagents-cli both write `.mcp.json`; when only one merged, `resolveOutputCollisions` failed the entire run for anyone with both enabled.

Also fixed: a TOML table header whose quoted key contains a bracket — `[projects."/Users/me/[wo]rk"]`, a legal path — was not recognised as a header, so it stayed inside the dropped `[mcp_servers.*]` region and was deleted along with its `trust_level`.

**Follow-up, shipped alongside this:** stale cleanup used to delete these same files whenever a run stopped emitting them. `managedOutputs.coOwnedFiles` now separates "agentsmesh owns this, delete it when stale" from "the user owns this too, never delete it" — see the co-owned managed-outputs entry.
