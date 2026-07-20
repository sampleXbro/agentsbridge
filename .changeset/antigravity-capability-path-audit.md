---
"agentsmesh": minor
---

Antigravity: promote commands to native (both scopes) and correct global workflows path.

- **Commands (project + global, partial → native)**: `generateCommands()` produces `.agents/workflows/<name>.md` files and the importer reads them back from the same directory. The old `partial` declaration was incorrect — full round-trip has always been present. Global scope commands round-trip via `ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR`.

- **Global workflows path corrected**: `ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR` was changed on this branch from `.gemini/antigravity/workflows` (master) to `.gemini/config/workflows` — but no primary source confirms `.gemini/config/workflows` as a valid Antigravity global workflows location. Multiple sources (GitHub Issue #16058 on google-gemini/gemini-cli and the antigravity-minimal-setup community repo) document the correct path as `~/.gemini/antigravity/global_workflows/`. The constant is now set to `.gemini/antigravity/global_workflows`. The MCP path (`.gemini/config/mcp_config.json`) and skills path (`.gemini/config/skills/`) are unaffected — both are confirmed by primary sources (Google Codelabs).

- **Global paths summary (final state)**:
  - Rules (global): `~/.gemini/GEMINI.md` (aggregate, all rules embedded)
  - Skills (global): `~/.gemini/config/skills/`
  - Commands/workflows (global): `~/.gemini/antigravity/global_workflows/`
  - MCP (global): `~/.gemini/config/mcp_config.json`
  - Hooks (global): `~/.gemini/config/hooks.json`
