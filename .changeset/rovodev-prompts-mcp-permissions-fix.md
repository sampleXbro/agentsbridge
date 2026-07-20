---
"agentsmesh": minor
---

Rovo Dev: raise Commands and Agents to native/embedded, add Ignore partial, fix MCP path, fix permissions schema.

- **Commands (project + global, none → native)**: `.rovodev/prompts.yml` (repo root) and `~/.rovodev/prompts.yml` (global user prompts) are real, documented saved-prompts manifests — https://support.atlassian.com/rovo/docs/save-and-reuse-a-prompt-in-rovo-dev-cli/ documents both the repo-root/cwd tier and the `~/.rovodev/prompts.yml` "global user prompts" tier. Canonical commands now generate a `prompts.yml` manifest entry (`name`/`description`/`content_file`) plus a `.rovodev/commands/<name>.md` content file, and both are read back on import. Commands are no longer projected as skills (`am-command-*` skill dirs) for this target.
- **Agents (project + global, none → embedded)**: Rovo Dev has no native agent file format; agents are projected as skill bundles under `.rovodev/skills/am-agent-<name>/SKILL.md` (project) and `~/.rovodev/skills/am-agent-<name>/SKILL.md` (global) via `supportsConversion: { agents: true }`. The old `supportsConversion: { commands: true, agents: true }` for commands is removed since commands are now native (no longer need conversion).
- **Ignore (project + global, none → partial)**: Rovo Dev has no dedicated project-level ignore file surface. `lintIgnore` warns when canonical ignore patterns are present but cannot be projected.
- **MCP (project): native → partial**. No project-level MCP config file is documented for Rovo Dev — only `~/.rovodev/mcp_config.json` (global) exists. `.rovodev/mcp.json` is no longer generated or imported at project scope; a `lintMcp` warning explains the drop to users. (Final level is `partial`, not `none` — the lint stub satisfies the schema contract.)
- **MCP (global): native — fixed path**. The generated/imported file is renamed from `~/.rovodev/mcp.json` to `~/.rovodev/mcp_config.json`, the actual documented filename (configurable via `mcp.mcpConfigPath` in `~/.rovodev/config.yml`).
- **Permissions (global): native — fixed schema**. `~/.rovodev/config.yml`'s `toolPermissions` now emits the real nested shape (`toolPermissions.tools.<name>: allow|ask|deny`, with bash rules under `toolPermissions.tools.bash.default` / `toolPermissions.tools.bash.commands[]`) instead of a flat `{allow:[],deny:[],ask:[]}` list the CLI never reads.

Source: https://support.atlassian.com/rovo/docs/manage-rovo-dev-cli-settings/, https://support.atlassian.com/rovo/docs/save-and-reuse-a-prompt-in-rovo-dev-cli/
