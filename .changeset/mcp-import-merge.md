---
'agentsmesh': minor
---

Sequential `agentsmesh import --from <target>` runs now merge MCP servers by name into `.agentsmesh/mcp.json` instead of replacing the whole file. Existing canonical entries are preserved and the imported set wins on name collision, so a `claude-code` import followed by a `cursor` import keeps both targets' servers in canonical state.

Affects every importer that writes `mcp.json`: `claude-code` (`.claude/settings.json` + `.mcp.json` + `~/.claude/.mcp.json`), `codex-cli` (`config.toml`), `continue`, `cursor`, and any descriptor-driven importer using `mode: 'mcpJson'`. The previous behavior — last import overwrites the file and silently drops earlier servers — is gone.

Also fixed: a build-time regression where `writeMcpWithMerge` was referenced by five importers without the backing module being shipped, breaking `tsc --noEmit` for consumers building from source.
