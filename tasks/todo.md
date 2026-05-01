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

---

# Plan: Logo Asset Refresh

Goal: Create a polished AgentsMesh logo family from one deterministic vector source, with a few practical rendered sizes for docs, social previews, and package branding.

## Checklist

- [x] Inspect existing logo/favicon usage
- [x] Replace website logo SVGs and favicon with the refreshed mark
- [x] Add rendered PNG sizes from the SVG source
- [x] Verify asset dimensions and render output

---

# Plan: Entire-library code review

Goal: Review the AgentsMesh TypeScript library end to end for correctness, scalability, code quality, and contract drift.

## Checklist

- [x] Gather baseline context: lessons, architecture review, package scripts, repo status
- [x] Run native gates and code-review helper scripts where they execute cleanly
- [x] Review public API, CLI routing, config/canonical loading, generate/import, reference rewriting, install, plugins, target descriptors, and tests
- [x] Verify candidate issues with exact source references and avoid reporting speculative items
- [x] Deliver prioritized findings with residual test/verification notes
