---
name: senior-manual-qa
description: Execute senior-level manual QA for TypeScript libraries and CLI tools using risk-based planning, strict evidence collection, and reproducible defect reporting. Use when the user asks for full test plans, edge-case validation, release-readiness checks, or complete manual QA passes.
---

# Senior Manual QA

Run this skill when a user asks to:
- "test the library completely"
- "create a test plan"
- "validate all edge cases"
- "do senior manual QA"
- "check release readiness"

This skill is for QA execution and reporting. It does not require code changes.

Mandatory output: create a QA report markdown file in the repository.

## Core Principles

- Test behavior, not assumptions.
- Prioritize business-critical flows first.
- Record evidence for every pass/fail claim.
- Keep tests deterministic and reproducible.
- Use isolated temp workspaces for destructive scenarios.
- Never claim completion while blockers remain.

## Phase 1: Build the Test Plan

Create a concise plan before running commands.

Include:
1. Scope (what is in/out).
2. Entry criteria (buildable state, dependencies installed).
3. Exit criteria (all required gates complete, blocker count).
4. Risk areas and priority order.
5. Test matrix (happy path, boundaries, invalid input, recovery, regression).
6. Environment details (OS, shell, Node/package manager).

## Phase 2: Baseline and Environment Checks

Capture baseline details:
- Current git status (clean or dirty).
- Node and package manager versions.
- Install state (`pnpm install` only if needed).
- Existing warnings that are known/non-blocking.

If a command mutates generated artifacts during tests, restore workspace state unless the user asked to keep changes.

## Phase 3: Quality Gate Execution

Run gates in this order unless the user overrides:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm test`
5. `pnpm test:e2e` (if available)
6. `pnpm test:coverage` (if available)
7. `pnpm audit --audit-level=high`

For each gate, record:
- command
- exit code
- duration (if available)
- key output lines

## Phase 4: Manual Edge-Case Matrix (CLI + Library)

Use isolated temp directories for manual CLI cases. Validate both exit code and message clarity.

Minimum matrix:

- Command discovery:
  - `--help`
  - `--version`
  - unknown command
- Required input validation:
  - missing config
  - missing required args
  - invalid option value
- Lifecycle flow:
  - init/setup
  - successful primary command flow
  - check/verify flow
- Drift/conflict behavior:
  - modify canonical input and re-check
  - confirm conflict output is actionable
- Install/import flow (if applicable):
  - happy path
  - no-op/sync with no manifest
  - invalid source path/format
- Error resilience:
  - malformed file (YAML/JSON/markdown frontmatter)
  - unsupported target/feature

## Phase 5: Coverage and Security Interpretation

- Treat coverage threshold failures as release blockers unless user says otherwise.
- Treat high/critical vulnerabilities as blockers by default.
- If vulnerability is transitive dev-only, still report severity and path.

## Phase 6: Defect Triage Rules

Classify findings:

- blocker: prevents release or core workflow
- high: major behavior regression, no safe workaround
- medium: degraded behavior, workaround exists
- low: minor UX/reporting issue

Every defect must include:
1. title
2. severity
3. reproduction steps
4. expected vs actual
5. command/output evidence
6. suspected area (optional)

## Phase 7: Create QA Report File

Create a markdown report file for every manual QA run.

Default path and naming:
- Directory: `tasks/reports/qa/`
- Filename: `qa-report-YYYY-MM-DD.md`

If `tasks/reports/qa/` does not exist, create it.
If a report already exists for the same date, append a numeric suffix:
- `qa-report-YYYY-MM-DD-2.md`
- `qa-report-YYYY-MM-DD-3.md`

The report file must contain:
- test plan
- executed commands with outcomes
- edge-case matrix results
- findings by severity
- coverage and security summary
- final release verdict

## Agentsmesh Runbook (Project-Specific)

When testing this repository, run the same end-to-end flow used by senior manual QA in this project:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm test`
5. `pnpm test:e2e`
6. `pnpm test:coverage`
7. `pnpm audit --audit-level=high`

Manual scenarios to include:
- `node dist/cli.js --help`
- `node dist/cli.js --version`
- `node dist/cli.js generate` in directory without config (must fail clearly)
- `node dist/cli.js foobar` (unknown command handling)
- init -> generate -> check happy path in temp project
- canonical drift then `check` (must detect conflict)
- lint with rules but no root rule (must fail with explicit guidance)
- invalid target in config (must fail schema validation)
- install without source (must fail with usage)
- install sync with no manifest (must return clean no-op message)
- target round-trip for every supported target: generate for one target, then import from that same target, and verify canonical remains consistent (`claude-code`, `cursor`, `copilot`, `continue`, `junie`, `gemini-cli`, `cline`, `codex-cli`, `windsurf`)
- extends feature must be validated end to end (init/config with extends -> generate -> check/diff/import as applicable)
- collaboration feature must be validated end to end (lock/check/merge lifecycle, including conflict and resolution paths)
- install must be validated end to end across scope variants: single item, list/path-scoped install, and amend/merge additional items from the same repository into an existing install

Must-have command coverage (all CLI commands):
- `node dist/cli.js init --yes` (or explicit no-yes flow) in temp project
- `node dist/cli.js generate --targets <targets>`
- `node dist/cli.js generate --dry-run`
- `node dist/cli.js generate --check`
- `node dist/cli.js generate --force` (lock strategy scenario)
- `node dist/cli.js generate --refresh-cache` or `--no-cache`
- `node dist/cli.js import --from <target>`
- `node dist/cli.js install <source>` happy path
- `node dist/cli.js install --sync` (with and without manifest)
- `node dist/cli.js install <source> --dry-run --path <dir> --as <kind>`
- `node dist/cli.js diff --targets <targets>`
- `node dist/cli.js lint --targets <targets>`
- `node dist/cli.js watch` (start, regen on change, clean stop)
- `node dist/cli.js check`
- `node dist/cli.js merge` (no conflict and conflict-resolution cases)
- `node dist/cli.js matrix --targets <targets> --verbose`

Must-have install coverage (all supported install pathways):

- Install modes:
  - `node dist/cli.js install <source>` (default pack materialization path)
  - `node dist/cli.js install <source> --extends` (writes extends entry mode)
  - `node dist/cli.js install --sync` with no manifest (clean no-op output)
  - `node dist/cli.js install --sync` with missing pack(s) in manifest (reinstall path)
- Resource scope variants:
  - `node dist/cli.js install <source> --as skills`
  - `node dist/cli.js install <source> --as rules`
  - `node dist/cli.js install <source> --as commands`
  - `node dist/cli.js install <source> --as agents`
  - `node dist/cli.js install <source> --path <dir>` (subdirectory slice)
  - `node dist/cli.js install <source> --target <id>` (native-target discovery override)
  - `node dist/cli.js install <source> --name <id>` (explicit pack/entry naming)
- Source format matrix:
  - Local path source (relative and absolute path variants)
  - GitHub tree URL source
  - GitHub blob URL source
  - GitLab tree URL source
  - GitLab blob URL source
  - SSH source (`git@github.com:...`, `git@gitlab.com:...`, generic `git@host:...`)
  - `git+https://...#<ref>` source
  - Pinned shorthand sources (`github:org/repo@ref`, `gitlab:namespace/project@ref`)
- Install behavior variants:
  - `--dry-run` preview (must not mutate config/packs)
  - `--force` non-interactive path
  - Missing source argument error path
  - Invalid source/path format error path
  - Post-install regeneration path (`generate` integration after successful install)

Must-have scenario coverage (E2E behavior contracts):
- Generate -> import round-trip per supported target: `claude-code`, `cursor`, `copilot`, `continue`, `junie`, `gemini-cli`, `cline`, `codex-cli`, `windsurf`
- Extends contract: local + remote/cached extends behavior and override precedence
- Collaboration contract: lock drift detection, merge conflict detection, merge conflict resolution, and post-resolution `check` pass
- Install contract: single-item install, list/scoped install, same-repo amend flow, and `install --sync` replay verification

Notes:
- Some e2e tests intentionally generate artifacts during execution. Clean up or restore afterward.
- Do not commit or push QA-generated changes unless explicitly requested.
- If the full chain stops early due to a failing command, continue running remaining gates individually to collect a complete QA picture.
- The final report must include exact failing test names and key assertion errors for blockers.

## Reporting Template

Use this structure in both:
- the QA report file (`tasks/reports/qa/qa-report-YYYY-MM-DD*.md`)
- the final QA response

```markdown
## QA Test Plan

### Scope
- ...

### Environment
- OS:
- Node:
- Package manager:

### Executed Gates
| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Typecheck | `pnpm typecheck` | PASS/FAIL | ... |

### Manual Edge Cases
| Scenario | Result | Evidence |
|----------|--------|----------|
| Missing config generate | PASS/FAIL | exit code + key output |

### Findings (Ordered by Severity)
1. **[severity] Title**
   - Repro:
   - Expected:
   - Actual:
   - Evidence:

### Coverage and Security
- Coverage: PASS/FAIL with threshold details
- Audit: PASS/FAIL with vuln summary

### Release Verdict
- PASS / FAIL
- Rationale:
- Recommended next actions:
```

## Completion Checklist

Before declaring QA complete:
- [ ] Test plan is documented.
- [ ] Required quality gates executed.
- [ ] Manual edge-case matrix executed.
- [ ] QA markdown report file is created in `tasks/reports/qa/`.
- [ ] Findings include reproducible evidence.
- [ ] Coverage and security status reported.
- [ ] Workspace state checked/restored as needed.
- [ ] Final verdict is explicit and justified.
