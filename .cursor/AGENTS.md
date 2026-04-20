# Operational Guidelines

## Session Start

- Read `../tasks/lessons.md` before doing any work. Apply relevant lessons.

## Workflow

### Planning

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions). Write plan to `../tasks/todo.md`.
- If something goes sideways, STOP and re-plan — don't keep pushing.
- Check in before starting implementation. Mark items complete as you go.

### Subagents

- Use subagents liberally for research, exploration, and parallel analysis. One tack per subagent.

### Lessons

- **When**: user correction, test failure, CI failure, code review feedback, or any other mistake signal.
- **How**: add a bullet to `../tasks/lessons.md` with (1) what went wrong, (2) root cause, (3) a rule that prevents recurrence.
- This is the primary cross-session memory — ruthlessly iterate until mistake rate drops.

### Verification

- Never mark a task complete without proving it works — run tests, check logs, demonstrate correctness.
- After every feature/story: use `post-feature-qa` skill (`./skills/post-feature-qa/`).
- Ask yourself: "Would a staff engineer approve this?"

### Elegance

- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer.

### Bug Fixing

- When given a bug report: just fix it. Find root cause, point at logs/errors, resolve. Zero hand-holding.

## Skills

- **post-feature-qa** — Apply after every feature/story. Senior QA: verify edge-case coverage and story alignment.
- **add-agent-target** — Use when adding a new AI agent target. Covers research, implementation, fixtures, full test coverage, docs.
- **add-global-mode-target** — Use when adding or extending **global mode** (`--global`, `../.agentsmesh/`) for an existing target. Covers descriptor.global wiring, import/generate paths, reference rewriting, tests, and matrix docs.


## Core Principles

- **Simplicity**: Make every change as simple as possible. Only touch what's necessary.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

## Project Rules

- **Architecture baseline**: Read `../docs/architecture/review.md` before architectural or multi-file changes.
- **Core flow to preserve**: canonical `../.agentsmesh/` content -> descriptor-driven generation/import (`src/targets/<id>/index.ts`) -> shared reference rewrite/lock checks -> strict artifact verification.
- **Scale limitations to account for**: avoid target-name hardcoding in shared/core code, avoid duplicated per-target helper logic, and keep capability variance expressed in descriptors (not ad-hoc generator branches).
- **Global mode discipline**: treat global support as one cohesive contract (layout + capabilities + detection + scope extras), not scattered one-off hooks.
- **TDD mandatory**: Write failing tests FIRST, then implement.
- **Max file size**: 200 lines. Split by responsibility if larger.
- **No classes unless stateful**: Prefer pure functions + types.
- **No `any`**: Use `unknown` + narrowing.
- **Config source of truth**: `../.agentsmesh/` directory. Generated files are artifacts.
- **Test naming**: `{module}.test.ts` colocated with source. Integration tests in `../tests/integration/`.
- **Generated artifact tests must be strict**: Assert exact file paths, exact file counts, and exact referenced wrapper/script sets. No loose checks (`some(...)`, prefix-only, "at least one").
- **Commit format**: conventional commits — `feat|fix|test|refactor(scope): message`
- **Docs must stay current**: Any change to CLI commands, flags, config schema, supported targets, or canonical file formats **must** be reflected in both `README.md` and the website (`../website/src/content/docs/`) before the task is marked complete.
- **Target data single source of truth** — do **not** hardcode target lists or support levels outside this chain:
  1. `../src/targets/catalog/target-ids.ts` (`TARGET_IDS`) = canonical target ID list. Each target's `capabilities` in `src/targets/<name>/index.ts` = feature support levels.
  2. `../src/core/matrix/data.ts` (`SUPPORT_MATRIX`) = built dynamically from descriptors. Never hardcode.
  3. `../website/src/content/docs/reference/supported-tools.mdx` = **single docs page** for per-target support. All other pages link here — no duplicate tables.
  4. `README.md` matrix must stay in sync with code capabilities.
  5. No hardcoded target counts or enumerations on homepage, CLI overview, or other pages. Use generic language and link to the matrix.
  6. Adding/changing a target: update `target-ids.ts` + descriptor → `supported-tools.mdx` → `README.md` matrix. No other docs pages should need changes.
- **Refer to PRD**: `../docs/prd-v2-complete.md` for architecture decisions
- **Refer to tasks**: `docs/agentsmesh-ai-first-tasks.md` for current task specs

---

## TypeScript-specific coding standards

Applies to: `src/**/*.ts`, `tests/**/*.ts`

# TypeScript Standards

- Use strict mode
- Prefer `unknown` over `any`
- Use explicit return types for public functions
- Prefer `interface` over `type` for object shapes

## AgentsMesh Generation Contract

`agentsmesh.yaml` selects targets/features (`agentsmesh.local.yaml` overrides locally), and `.agentsmesh` is the only place to add or edit canonical items: `rules/_root.md`, `rules/*.md`, `commands/*.md`, `agents/*.md`, `skills/*/SKILL.md` plus supporting files, `mcp.json`, `hooks.yaml`, `permissions.yaml`, and `ignore`; if missing run `agentsmesh init`, use `agentsmesh import --from <tool>` for native configs, `agentsmesh install <source>` or `install --sync` for reusable packs, then run `agentsmesh generate`. Use `diff`, `lint`, `check`, `watch`, `matrix`, and `merge` as needed; never edit generated tool files.