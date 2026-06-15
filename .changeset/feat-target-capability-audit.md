---
'agentsmesh': minor
---

feat: close 23 target capability gaps and make new MCP capabilities round-trip

Audited every supported target and implemented native or partial support for
capabilities the underlying tools already offer but agentsmesh did not expose:

- **MCP**: Goose (global, `~/.config/goose/config.yaml` extensions) and Copilot
  (project, `.vscode/mcp.json`) now both generate **and import** MCP servers, so
  the new native MCP capabilities round-trip back to canonical.
- **Agents**: Augment Code, Amazon Q, and Cline gain native agent definitions.
- **Skills / Commands**: Zed emits shared native skills; Trae gains native
  commands (`.trae/commands/`).
- **Permissions**: Junie (global allowlist) and Kilo Code (`kilo.jsonc`) gain
  native permissions; Warp, Roo Code, and Antigravity declare `partial` support
  with lint guidance pointing at their UI / settings.
- **Hooks**: Factory Droid, Deep Agents CLI, Antigravity, Qwen Code, Amp, and
  Codex CLI gain native lifecycle hooks.
- **Combined settings sidecars**: Qwen Code and Amp write hooks + permissions
  into their settings files; Rovo Dev writes hooks + permissions to its global
  `config.yml`; Amazon Q gains agents + hooks + permissions.

The shared `mcpJson` import mode gains an optional, data-driven `mcpServersKey`
(defaults to `mcpServers`) so VS Code-style files keyed on `servers` import
correctly — with no target-name hardcoding in core. The support matrix in the
README and docs site is updated to match.
