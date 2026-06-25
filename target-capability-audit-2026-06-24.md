# Target Capability Audit - 2026-06-24

This note summarizes the full 30-target capability audit performed with one
read-only subagent per target.

Priority model:

- P0: under-declared capability, wrong native file path, wrong native format, or
  a Native claim without import/round-trip support.
- P1: stale fidelity gaps where the capability is broadly present but fields,
  transport variants, or merge behavior are incomplete.
- P2: over-declared capabilities. These are less urgent because they usually do
  not hide supported tool features from users, but they should still be cleaned
  up when touching the target.

## Highest Priority

| Target | Priority | Findings |
| --- | --- | --- |
| Antigravity | P0 | Global paths are stale: current docs use `~/.gemini/GEMINI.md`, `~/.gemini/config/skills/`, `~/.gemini/config/mcp_config.json`. Hooks are emitted in the wrong shape and lack import. |
| Augment Code | P0 | Permissions are under-declared: project/global `toolPermissions` in `settings.json`. Global hooks are under-declared. Rule frontmatter should use `type`, not legacy booleans. |
| Continue | P0 | Hooks are under-declared for project/global settings. Global permissions are under-declared at `~/.continue/permissions.yaml`. Global `config.yaml` can clobber existing user config. |
| Factory Droid | P0 | Agents and hooks are declared native but lack import. Commands are under-declared because `.factory/commands/` exists. Permissions should at least be Partial. |
| Goose | P0 | Hooks are under-declared via `.agents/plugins/*/hooks/hooks.json`. Global permissions are under-declared at `~/.config/goose/permission.yaml`. Global MCP needs YAML merge safety and current `streamable_http` mapping. |
| Kiro | P0 | Permissions are under-declared: global native `~/.kiro/settings/permissions.yaml`, project partial because workspace permissions live outside the repo. |
| PI Agent | P0 | Commands are under-declared: project `.pi/prompts/*.md`, global `~/.pi/agent/prompts/*.md`. |
| Rovo Dev | P0 | Commands and agents are under-declared via `.rovodev/prompts.yml` and `.rovodev/subagents/*.md`. Global hooks/permissions are not round-tripped and permissions use the wrong shape. |
| Trae | P0 | Hooks are under-declared: project `.trae/hooks.json`, global `~/.trae/hooks.json`. Project agents are a likely new capability behind `.trae/agents`, but exact schema needs confirmation. |
| Warp | P0 | MCP uses the wrong file: Warp-native path is `.warp/.mcp.json` and `~/.warp/.mcp.json`, not `.mcp.json`. Project ignore is under-declared via `.warpindexingignore`. |
| Zed | P0 | Global rules and skills are under-declared: `~/.config/zed/AGENTS.md` and global `.agents/skills/`. Permissions and ignore should likely be Partial via settings. |

## Wrong Path Or Format

| Target | Priority | Findings |
| --- | --- | --- |
| Amazon Q | P0 | Agent JSON uses official `prompt`, but AgentsMesh writes/imports `systemPrompt`. Project additional rules are under-declared. Hooks/permissions should likely be Partial because they are agent-scoped. |
| Claude Code | P0 | Rule frontmatter should use `paths`, not `globs`. Global hooks belong in `settings.json`, not `~/.claude/hooks.json`. `.claudeignore` appears legacy; ignore should be embedded through permissions deny if supported. |
| Cline | P0 | Hook filenames are wrong for current Cline event matching. Global rules/commands are generated to supported paths but imported from project-style paths. MCP paths need current source-aligned correction. |
| Codex CLI | P0 | MCP is stdio-only today while Codex supports streamable HTTP fields. `.codex/config.toml` needs merge preservation. Project additional rules are questionable unless using documented nested `AGENTS.md` paths. |
| Cursor | P0 | Hooks use stale Pascal-case events; current docs use lower-camel events. Project additional rules are under-declared as Embedded despite native `.cursor/rules/*.mdc`. |
| Deep Agents CLI | P0 | Global rules/skills paths are wrong because current globals are per-agent under `~/.deepagents/{agent}/`. Hooks use the wrong JSON format and project hooks appear unsupported. Agents should be native. |
| Gemini CLI | P0 | Project permissions generation is misleading because workspace policies are disabled upstream. Global permissions are under-declared. Project ignore flavor is wrong: it is `.geminiignore`, not settings-embedded. |
| Kilo Code | P0 | Global paths should use `~/.config/kilo/*`, not `~/.kilo/*`. MCP should move to `kilo.json[c]` top-level `mcp`. Permissions lack import and key mapping. |
| OpenCode | P0 | Additional rules should be wired through `opencode.json.instructions`, not `.opencode/rules/`. Settings merge does not overlay OpenCode keys `mcp`, `permission`, and future `instructions`. |
| Qwen Code | P0 | Global additional rules are under-declared; Qwen supports `~/.qwen/rules/**/*.md`. Rule frontmatter should use `paths`. Hooks and permissions lack import despite Native claims. MCP needs `url` vs `httpUrl` mapping. |
| Roo Code | P0 | Global paths are wrong: root rules should be under `~/.roo/rules/`; global MCP is storage-base dependent; global ignore is unsupported. Project agents are generated but not imported. |
| Windsurf | P0 | Current rules prefer `.devin/rules/*.md`. Hooks use stale generic names instead of current action-specific events. Global native paths are generated but not imported. Project MCP Partial currently emits a file, which violates the no-op Partial rule. |

## Lower Priority Over-Declarations

These are still real cleanup items, but less urgent than hidden support or wrong
formats.

| Target | Priority | Findings |
| --- | --- | --- |
| Aider | P2 | Skills appear over-declared because `.aider/skills/` is not evidenced as a native Aider surface. `CONVENTIONS.md` should be wired through `.aider.conf.yml` `read:` to be truly native. |
| Amp | P2 | Commands are projected as skills, not native plugin commands. Hooks are not confirmed as a settings key. Permissions are wrong shape and lack import. |
| Copilot | P2 | Global commands path is uncertain. Ignore and permissions are UI or managed-settings surfaces and should be Partial at most. Project hooks look closer to Native than current Partial. |
| Crush | P2 | Global MCP/hooks native claims lack global import. Permissions should be Partial/allow-only unless schema supports deny/ask. Commands may be Embedded through user-invocable skills. |
| Replit Agent | P2 | MCP should be Partial through UI/install links. Global rules/skills are UI-managed Partial candidates. Enterprise `custom_instruction/instructions.md` is a separate design decision. |
| Warp | P2 | Global rules are UI-managed Partial rather than None. Project additional rules may become Native if mapped to subdirectory `AGENTS.md`/`WARP.md`. |

## Mostly Aligned

No target was completely free of notes, but these findings were narrower or
mostly fidelity/documentation work:

- Jules: MCP should move from None to Partial because Jules now supports
  UI-managed MCP service connections.
- Zed: Project MCP is aligned, but adding permissions/ignore would require
  pending-aware settings merge or a combined settings emitter.
- Gemini CLI, Qwen Code, OpenCode, and Cursor: broad capability coverage is good,
  but current docs require frontmatter, transport, or settings-key corrections.

## Implementation Guidance

- Fix under-declared and wrong-format issues before spending time on pure
  over-declaration cleanup.
- Do not claim Native unless generation and import both exist.
- Partial means no-op generation plus a lint warning; do not emit example files
  for Partial capabilities.
- Any target writing multiple keys into one settings file must merge from
  `pending?.content ?? existing`.
- Split target files before adding code when `index.ts` is already near or above
  200 lines.
- Regenerate and verify the support matrix after descriptor changes, then sync
  both `README.md` and `website/src/content/docs/reference/supported-tools.mdx`.
