# Plan: Launch readiness improvements (README, package.json, launch issues)

Goal: Improve the first-30-second impression for developers discovering AgentsMesh, without inventing unsupported commands or flags.

## CLI audit (verified against `src/cli/`)

- Top-level commands: `init`, `generate`, `import`, `diff`, `lint`, `watch`, `check`, `merge`, `matrix`, `install`, `plugin`, `target`
- Bin aliases: `agentsmesh`, `amsh`
- Verified flags: `--global`, `--targets <csv>`, `--check`, `--dry-run`, `--force`, `--from <target>`, `--yes`
- `init`, `generate`, `check`, `diff`, `import` all real and behave as the prompt expects
- `npx agentsmesh ...` and `pnpm dlx agentsmesh ...` both supported via the npm `bin` field

## Checklist

- [x] Audit CLI commands and flags
- [ ] Restructure `README.md`:
  - [ ] Problem-first opening (no hype)
  - [ ] Before / After section near the top
  - [ ] 60-second quickstart (init → generate → check)
  - [ ] Safe adoption flow for existing repos (import → diff → generate → check)
  - [ ] "Why not just AGENTS.md?" section
  - [ ] Terminal demo section with TODO placeholder for GIF
  - [ ] Preserve high-demand features, matrix, programmatic API, contributing
- [ ] Update `package.json` `homepage` to docs site
- [ ] Create `tasks/launch-issues/` with 5 markdown issue stubs
- [ ] Run lint + typecheck + relevant tests
