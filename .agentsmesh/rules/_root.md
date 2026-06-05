---
root: true
description: ""
---

# Operational Guidelines

## Workflow

### Planning

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions). Write plan to `tasks/todo.md`.
- If something goes sideways, STOP and re-plan — don't keep pushing.
- Check in before starting implementation. Mark items complete as you go.

### Subagents

- Use subagents liberally for research, exploration, and parallel analysis. One tack per subagent.

### Verification

- Never mark a task complete without proving it works — run tests, check logs, demonstrate correctness.
- After every feature/story: use `post-feature-qa` skill (`.agentsmesh/skills/post-feature-qa/`).
- Ask yourself: "Would a staff engineer approve this?"

### Elegance

- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer.

### Bug Fixing

- When given a bug report: just fix it. Find root cause, point at logs/errors, resolve. Zero hand-holding.

## Skills

- **post-feature-qa** — Apply after every feature/story. Senior QA: verify edge-case coverage and story alignment.
- **add-agent-target** — Use when adding a new AI agent target. Covers research, implementation, fixtures, full test coverage, docs.
- **add-global-mode-target** — Use when adding or extending **global mode** (`--global`, `.agentsmesh`) for an existing target. Covers descriptor.global wiring, import/generate paths, reference rewriting, tests, and matrix docs.


## Core Principles

- **Simplicity**: Make every change as simple as possible. Only touch what's necessary.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

## Project Rules

- **Architecture baseline**: Read `docs/architecture/review.md` before architectural or multi-file changes.
- **Core flow to preserve**: canonical `.agentsmesh` content -> descriptor-driven generation/import (`src/targets/<id>/index.ts`) -> shared reference rewrite/lock checks -> strict artifact verification.
- **Scale limitations to account for**: avoid target-name hardcoding in shared/core code, avoid duplicated per-target helper logic, and keep capability variance expressed in descriptors (not ad-hoc generator branches).
- **Global mode discipline**: treat global support as one cohesive contract (layout + capabilities + detection + scope extras), not scattered one-off hooks.
- **TDD mandatory**: Write failing tests FIRST, then implement.
- **Max file size**: 200 lines. Split by responsibility if larger.
- **No classes unless stateful**: Prefer pure functions + types.
- **No `any`**: Use `unknown` + narrowing.
- **Config source of truth**: `.agentsmesh` directory. Generated files are artifacts.
- **Test naming**: `{module}.test.ts` colocated with source. Integration tests in `tests/integration/`.
- **Generated artifact tests must be strict**: Assert exact file paths, exact file counts, and exact referenced wrapper/script sets. No loose checks (`some(...)`, prefix-only, "at least one").
- **Commit format**: conventional commits — `feat|fix|test|refactor(scope): message`
- **Docs must stay current**: Any change to CLI commands, flags, config schema, supported targets, or canonical file formats **must** be reflected in both `README.md` and the website (`website/src/content/docs/`) before the task is marked complete.
- **Target data single source of truth** — do **not** hardcode target lists or support levels outside this chain:
  1. `src/targets/catalog/target-ids.ts` (`TARGET_IDS`) = canonical target ID list. Each target's `capabilities` in `src/targets/<name>/index.ts` = feature support levels.
  2. `src/core/matrix/data.ts` (`SUPPORT_MATRIX`) = built dynamically from descriptors. Never hardcode.
  3. `website/src/content/docs/reference/supported-tools.mdx` = **single docs page** for per-target support. All other pages link here — no duplicate tables.
  4. `README.md` matrix must stay in sync with code capabilities.
  5. No hardcoded target counts or enumerations on homepage, CLI overview, or other pages. Use generic language and link to the matrix.
  6. Adding/changing a target: update `target-ids.ts` + descriptor → `supported-tools.mdx` → `README.md` matrix. No other docs pages should need changes.
- **CLI display paths must use forward slashes**: Any CLI output displaying file paths to users must normalize with `.replaceAll('\\', '/')` before printing. Tests assert forward-slash paths unconditionally; native `node:path` separators leak platform differences into output.
- **Load-bearing contracts** — verify before claiming any non-trivial change complete:
  - **Plugins**: every install path picks up `registerTargetDescriptor()` non-`.md` mappers via `getAllRegisteredDescriptorIds()` (`tests/unit/install/importers/target-native-commands-plugin.test.ts`).
  - **Reference rewriting**: `(SPEC.md or equivalent)` prose stays verbatim; real Markdown inline-link destinations rewrite cross-format (`tests/unit/core/link-token-classifier-prose-vs-md-link.test.ts`).
  - **Install**: third-party dir-readers route through `readEntityDirWithMappers`; the 79-repo sweep in `docs/testing/install-compatibility-repos.md` stays green.

<!-- agentsmesh:lessons-contract:start -->
## Lessons (BLOCKING REQUIREMENT — MUST run, no exceptions)

Two shell commands. Skipping either is a process violation; the user will check. The graph at `.agentsmesh/lessons/lessons.json` is canonical — NEVER edit by hand.

**Recall — MUST run BEFORE every file edit and every shell command:**

1. Run: `agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>` (add `--keyword <text>` for task matches).
2. Apply EVERY returned rule.
3. Then perform the edit / run the command.

Rejected excuses: *"the edit is small"* → query it. *"I already know this"* → query it. *"I'll do it later"* → no.

**Capture — MUST run IMMEDIATELY after any failure** (test, CI, lint, code review, user correction, regression — anyone's mistake):

1. Run: `agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>` (add `--trigger-cmd <regex>` / `--trigger-kw <text>` as needed).
2. Use `agentsmesh lessons topics` to find the topic id; pass `--new-topic --topic-summary "<one line>"` for a brand-new area.
3. The CLI writes `lessons.json` atomically — capture is one command.

Rejected excuses: *"it wasn't really a failure"* → it was. *"I'll capture it later"* → no. *"no topic fits"* → `agentsmesh lessons topics` then `--new-topic`.

No shell? Use the `lessons_query` and `lessons_add` MCP tools — same two operations. Run `agentsmesh lessons --help` for the full command set (`show`, `deprecate`, `journal`, `validate`, `import-md`).

**These two commands ARE the system. Skip them and the system does not exist.**
<!-- agentsmesh:lessons-contract:end -->
