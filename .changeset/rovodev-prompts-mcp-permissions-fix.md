---
"agentsmesh": minor
---

Rovo Dev: raise Commands to native, fix broken MCP path and permissions schema, drop unsupported project MCP.

- **Commands (project + global, none → native)**: `.rovodev/prompts.yml` (repo root) and `~/.rovodev/prompts.yml` (global user prompts) are real, documented saved-prompts manifests — https://support.atlassian.com/rovo/docs/save-and-reuse-a-prompt-in-rovo-dev-cli/ documents both the repo-root/cwd tier and the `~/.rovodev/prompts.yml` "global user prompts" tier. Canonical commands now generate a `prompts.yml` manifest entry (`name`/`description`/`content_file`) plus a `.rovodev/commands/<name>.md` content file, and both are read back on import. Commands are no longer projected as skills (`am-command-*` skill dirs) for this target.
- **MCP (project): native → none**. No project-level MCP config file is documented for Rovo Dev — only `~/.rovodev/mcp_config.json` (global) exists. `.rovodev/mcp.json` is no longer generated or imported at project scope; a project-scope lint warning explains the drop.
- **MCP (global): native — fixed path**. The generated/imported file is renamed from `~/.rovodev/mcp.json` to `~/.rovodev/mcp_config.json`, the actual documented filename (configurable via `mcp.mcpConfigPath` in `~/.rovodev/config.yml`).
- **Permissions (global): native — fixed schema**. `~/.rovodev/config.yml`'s `toolPermissions` now emits the real nested shape (`toolPermissions.tools.<name>: allow|ask|deny`, with bash rules under `toolPermissions.tools.bash.default` / `toolPermissions.tools.bash.commands[]`) instead of a flat `{allow:[],deny:[],ask:[]}` list the CLI never reads.

Source: https://support.atlassian.com/rovo/docs/manage-rovo-dev-cli-settings/, https://support.atlassian.com/rovo/docs/save-and-reuse-a-prompt-in-rovo-dev-cli/
