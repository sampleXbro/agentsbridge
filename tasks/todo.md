# Windows Support — Hooks/Permissions/MCP

## Goal

Audit whether generated hook, permission, and MCP artifacts work the same on Windows as macOS, and surface a lint warning for the only real cross-platform gap.

## Findings

- **Permissions**: pure JSON pass-through (`.claude/settings.json`). No platform difference. Pattern semantics are the agent tool's responsibility, not agentsmesh's.
- **MCP**: every target serializes `command`/`args` verbatim to JSON/TOML. No `npx` → `npx.cmd` rewrite, but every major MCP client resolves shims itself. No platform difference at the agentsmesh layer.
- **Hooks (claude-code/cursor/windsurf/kiro/gemini-cli)**: the user's `command` is embedded as a string in the target's config; the agent runs it. No platform difference at the agentsmesh layer.
- **Hooks (cline & copilot)**: agentsmesh emits `.sh` wrapper files with `#!/usr/bin/env bash`. **Real Windows gap** — they need git-bash/WSL to execute.

## Plan

- [x] Add failing tests in `tests/unit/core/linter-hooks.test.ts` for new cline `lintHooks` and the new copilot Windows-shell warning.
- [x] Implement `lintHooks` in `src/targets/cline/lint.ts`; wire it into the cline descriptor (`src/targets/cline/index.ts`).
- [x] Extend `src/targets/copilot/lint.ts` `lintHooks` to also emit the Windows-shell warning when hooks are present.
- [x] Update existing copilot unsupported-event test to filter for the relevant diagnostic (since hooks present now also emits the shell warning).
- [x] Add a Windows portability paragraph to `website/src/content/docs/canonical-config/hooks.mdx`.
- [x] Run typecheck, lint, full unit/integration suite, build, and e2e. 3205 + 401 passing.
