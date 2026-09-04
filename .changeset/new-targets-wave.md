---
'agentsmesh': minor
---

**Three new targets: OpenHands, Kimi Code CLI and Codebuff.** agentsmesh now supports 33 tools.

**OpenHands** (`openhands`) — the open-source autonomous coding agent. Rules to `AGENTS.md`, path-scoped rules and skills to `.agents/skills/`, subagents to `.agents/agents/`, commands and MCP into a `.agents/plugins/agentsmesh/` bundle, and hooks to `.openhands/hooks.json`. Hooks are the one surface that did *not* move to `.agents/`, and its `HookConfig` forbids unknown keys outright, so only verified snake_case events are emitted. `AGENTS.md` is written with no frontmatter because OpenHands injects that file verbatim into the prompt.

**Kimi Code CLI** (`kimi-code`) — Moonshot AI's terminal agent. Rules to `AGENTS.md`, subagents to `.kimi-code/agents/`, skills to `.kimi-code/skills/`, MCP to `.kimi-code/mcp.json` (a genuine project-scope MCP file, which is rare), and hooks plus permissions into `~/.kimi-code/config.toml`. Those last two are user-scope only — Kimi Code has no project config file. That TOML also holds provider API keys in plain text, so agentsmesh merges key-scoped and never rewrites the file.

**Codebuff** (`codebuff`) — the multi-agent terminal CLI. Rules to `AGENTS.md` including nested per-directory files, skills to `.agents/skills/`, MCP to `.agents/mcp.json`, and ignore to `.codebuffignore`. Agents and permissions stay `partial`: Codebuff agents are executable TypeScript modules, and agentsmesh generates config, not code.

OpenHands and Codebuff both read `.agents/skills/`, which `codex-cli` owns, so each emits byte-identical skill content and is registered as a native `.agents/` writer — without that, `generate --global` alongside Claude Code threw `Conflicting generated outputs`. Kimi Code writes its own `.kimi-code/skills/` at both scopes and is not part of that set.

Two behaviours worth knowing before you run this:

- **Kimi Code concatenates every instruction file it finds** rather than picking the first, so a `.kimi-code/AGENTS.md` left over from a previous setup would double your rules in the prompt. It is now a managed output and `agentsmesh generate` removes it; the root `AGENTS.md` carries the merged content.
- **Codebuff's scope precedence is inverted** relative to every other target: it searches `[cwd/.agents, cwd/../.agents, ~/.agents]` last-write-wins, so a global file overrides the project one. It also has a middle scope (the parent directory, for monorepos) that agentsmesh cannot express.
