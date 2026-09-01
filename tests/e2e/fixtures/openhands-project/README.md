# billing-service

Fixture project for OpenHands import coverage: `AGENTS.md`, path-scoped rules and
skill bundles under `.agents/skills/`, subagents under `.agents/agents/`, the
`agentsmesh` plugin (commands + MCP servers), and `.openhands/hooks.json` with
its hook script in `.openhands/hooks/`.

The hooks file is written the way the OpenHands docs write one: command handlers
omit `type` (`HookDefinition.type` defaults to `command`) and the `stop` event
uses a `prompt` handler.
