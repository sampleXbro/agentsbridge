---
root: true
---

# Operational Guidelines

## Session Start

- **Always** read `tasks/lessons.md` at the beginning of each session before doing any work
- Apply relevant lessons to the current task

## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop

- **When to amend** `tasks/lessons.md`: whenever something turns out wrong — user correction, test failure, CI failure, code review feedback, or any other signal that a mistake was made
- **How to amend**: add a bullet with (1) what went wrong, (2) the root cause, (3) a rule that prevents the same mistake
- **Best practice for AI agents**: updating lessons is the primary way to persist learning across sessions; agents lack long-term memory, so `tasks/lessons.md` is the project-specific memory that reduces repeated mistakes
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- **After every feature/story completion**: Use the `post-feature-qa` skill (`.agentsmesh/skills/post-feature-qa/`) — run the QA checklist, ensure tests cover edge cases and implementation aligns with the story, fix gaps before marking done
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections — see "When to amend" and "How to amend" in Self-Improvement Loop above

## Skills

- **post-feature-qa** (`.agentsmesh/skills/post-feature-qa/`) — Apply after every feature or story implementation. Act as senior QA: verify test coverage for all edge cases and story alignment; produce QA report; fix gaps before claiming complete.
- **add-agent-target** (`.agentsmesh/skills/add-agent-target/`) — Use when adding support for a new AI agent target. Requires current official-doc research, full import/generate implementation, rich realistic fixtures, complete unit/integration/e2e coverage, docs updates, and final QA.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Project-Specific Rules

- **TDD mandatory**: Write failing tests FIRST, then implement. No exceptions.
- **Max file size**: 200 lines. Split by responsibility if larger.
- **No classes unless stateful**: Prefer pure functions + types.
- **No `any`**: Use `unknown` + narrowing.
- **Config source of truth**: `.agentsmesh/` directory. Generated files are artifacts.
- **Test naming**: `{module}.test.ts` colocated with source. Integration tests in `tests/integration/`.
- **Generated artifact tests must be strict**: For generated file structures, assert exact file paths, exact file counts, and exact referenced wrapper/script sets. Do not use loose checks like "at least one file", broad `some(...)`, or prefix-only path assertions when the full output set is known.
- **Commit format**: conventional commits — `feat|fix|test|refactor(scope): message`
- **README must stay current**: Any change to CLI commands, flags, config schema, supported targets, or canonical file formats **must** be reflected in `README.md` before the task is marked complete. Treat the README as part of the API surface.
- **Refer to PRD**: `docs/prd-v2-complete.md` for architecture decisions
- **Refer to tasks**: `docs/agentsmesh-ai-first-tasks.md` for current task specs