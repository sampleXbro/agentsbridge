---
name: prepare-release
description: "Use this skill whenever preparing agentsbridge for an npm release — whether first publish, patch, minor, or major. Triggers on: 'prepare release', 'ready to publish', 'ship version', 'release prep', 'get this to npm', 'bump version', 'cut a release', 'what's needed to publish'. Runs a strict ordered checklist: test suite health → timing hardening → CI/CD presence → community health files → changesets → CHANGELOG quality → package contents → README badges → final gate. Do not skip this or work from memory — execute every phase in order and fix gaps before moving on."
---

# Prepare Release

You are acting as the release engineer for agentsbridge. Your job is to get the repo into a state that is safe, honest, and ready for `npm publish`. Work through each phase in order. Do not mark a phase complete until you have verified it, not just assumed it.

## Phase 1 — Test Suite Health

Run the full suite and confirm everything is green before touching anything else.

```bash
pnpm test
```

If there are failures, fix them first. Do not proceed with a red suite.

Then run typecheck and lint:

```bash
pnpm typecheck
pnpm lint
```

All three must be clean.

### Watch test timing (known CI risk)

The watch tests are timing-sensitive and reliably flake on CI runners slower than a developer laptop. Before declaring the suite healthy, check these specific timeouts in the watch tests:

| File | What to check | Safe CI value |
|------|--------------|---------------|
| `tests/unit/cli/commands/watch.test.ts` | `vi.waitFor` timeout args | ≥ 3000 ms |
| `tests/unit/cli/commands/watch.test.ts` | idle stability `setTimeout` | ≥ 2000 ms |
| `tests/integration/watch.integration.test.ts` | startup `setTimeout` | ≥ 3000 ms |
| `tests/integration/watch.integration.test.ts` | post-change `setTimeout` | ≥ 1500 ms |
| `tests/e2e/watch.e2e.test.ts` | startup `setTimeout` | ≥ 3000 ms |
| `tests/e2e/watch.e2e.test.ts` | post-change `setTimeout` | ≥ 1500 ms |

Also verify `vitest.config.ts` has global guards:

```ts
testTimeout: 15_000,
hookTimeout: 10_000,
```

If any of these are missing or too low, update them now. The watch debounce is 300 ms plus generate time; tight timeouts that work on a fast local machine will fail on a 2-core CI runner.

## Phase 2 — CI/CD Workflows

Check that both workflow files exist:

- `.github/workflows/ci.yml` — runs on every push and PR to `main`
- `.github/workflows/release.yml` — runs changesets publish flow on push to `main`

### ci.yml must include these steps in order

1. `pnpm install --frozen-lockfile`
2. `pnpm audit --prod --audit-level=high` — catches high/critical vulns in production deps only
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm test:coverage` with Codecov upload (`fail_ci_if_error: false` so fork PRs don't break)
7. `pnpm build`
8. `pnpm test:e2e` — must come after build; e2e runs `dist/cli.js`

Use Node 22 + pnpm 10 + `cache: pnpm` in `setup-node`. Never run e2e in parallel with build — they share `dist/`.

### release.yml must use changesets/action@v1

```yaml
- uses: changesets/action@v1
  with:
    publish: pnpm release
    title: "chore: version packages"
    commit: "chore: version packages"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The `release.yml` job needs `id-token: write` for npm provenance.

If either file is missing or malformed, create/fix it now.

## Phase 3 — Community Health Files

These must exist. Check each one:

| File | Minimum content |
|------|----------------|
| `SECURITY.md` | Supported versions table, private advisory link, response SLA |
| `CONTRIBUTING.md` | Prerequisites, dev commands, TDD rule, commit format, PR checklist |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | version, node, repro, expected behavior fields |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | problem + solution fields |
| `.github/ISSUE_TEMPLATE/config.yml` | `blank_issues_enabled: false`, security advisory link |
| `.github/pull_request_template.md` | type-of-change checklist, TDD + CI + changeset checkboxes |

If any are missing, create them. Keep them short and factual — no marketing copy.

## Phase 4 — Changesets Setup

Verify changesets is configured for the automated release flow:

1. `.changeset/config.json` exists with `"access": "public"` and `"baseBranch": "main"`
2. `@changesets/cli` is in `devDependencies` in `package.json`
3. `package.json` has these scripts:
   ```json
   "changeset": "changeset",
   "version": "changeset version",
   "release": "pnpm build && changeset publish"
   ```
4. `pnpm install` has been run after adding the dependency (lockfile is up to date)

If the config is missing, create it. If the package is missing, add it and run `pnpm install`.

### Changeset workflow for this release

If this is the first release or there is no pending changeset file in `.changeset/`:

```bash
pnpm changeset
```

Follow the prompts: select the bump type (patch/minor/major), write a one-line summary of what changed. Commit the resulting `.changeset/*.md` file. The `release.yml` workflow will consume it on the next push to `main`.

## Phase 5 — CHANGELOG

Open `CHANGELOG.md`. The entry for the version being released must:

- Have the real date (`YYYY-MM-DD`), not `TBD`
- Cover every major user-facing addition since the previous release
- Be written for users, not for commit archaeology — describe the capability, not the implementation

### Required sections for a first-ever release (v0.1.0)

Group under clear subheadings:

- **CLI commands** — one line per command: what it does, key flags
- **Supported targets** — comma-separated list
- **Canonical features** — rules, commands, agents, skills, mcp, hooks, ignore, permissions
- **Config** — describe `agentsbridge.yaml`, `agentsbridge.local.yaml`, `.agentsbridge/`, `.lock`
- **Extends** — local and remote forms with example syntax
- **Link rebasing** — one sentence on what it does
- **Collaboration** — lock file, `check`, `merge`

For subsequent releases (patch/minor/major), follow Keep a Changelog format with Added / Changed / Fixed / Removed sections.

## Phase 6 — Package Contents

Run a dry-run pack and inspect what would be published:

```bash
pnpm pack --dry-run
```

The tarball must contain **only**:

```
CHANGELOG.md
dist/cli.js
dist/cli.js.map
LICENSE
package.json
README.md
```

Source files, test files, fixtures, `.agentsbridge/`, `docs/`, `tasks/`, and `tsconfig.json` must not appear. The `files` field in `package.json` controls this — it should be:

```json
"files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"]
```

If unexpected files appear in the pack output, add them to `.npmignore` or tighten the `files` field.

## Phase 7 — README Badges

The README must have these four badges immediately after the `# AgentsBridge` heading:

```markdown
[![CI](https://github.com/agentsbridge/agentsbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/agentsbridge/agentsbridge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsbridge.svg)](https://www.npmjs.com/package/agentsbridge)
[![Coverage](https://codecov.io/gh/agentsbridge/agentsbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/agentsbridge/agentsbridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

The CI badge will show "passing" once the first CI run completes. The npm version badge shows the published version; it will display correctly once the package is on the registry. Coverage requires a `CODECOV_TOKEN` secret set in GitHub repo settings.

## Phase 8 — Final Gate

Run the full test suite one more time with coverage to confirm nothing was broken by the release prep changes:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm build
```

Coverage thresholds are set in `vitest.config.ts`:

```
lines: 90%, functions: 90%, branches: 84%
```

If coverage drops below threshold, the CI run will fail. Either add missing tests or, if coverage dropped because of legitimately untestable I/O code, add the file to the `coverage.exclude` list in `vitest.config.ts` with a comment explaining why.

## Phase 9 — Generate to All Targets

Once all phases pass, sync the canonical skill to every configured target:

```bash
ab generate
```

This rewrites the skill to Claude Code, Cursor, Copilot, Gemini CLI, Cline, Codex CLI, Windsurf, Continue, and Junie in their native formats. Verify the lock file updates cleanly with no unexpected diffs.

## Output

After all phases, produce a release readiness report:

```markdown
## Release Readiness — agentsbridge v{version}

| Phase | Status | Notes |
|-------|--------|-------|
| Test suite | ✓/✗ | |
| Watch timing | ✓/✗ | |
| CI workflows | ✓/✗ | |
| Community files | ✓/✗ | |
| Changesets | ✓/✗ | |
| CHANGELOG | ✓/✗ | |
| Package contents | ✓/✗ | |
| README badges | ✓/✗ | |
| Final gate | ✓/✗ | |
| Generated to targets | ✓/✗ | |

### Remaining actions before publish
- [ ] Set NPM_TOKEN secret in GitHub repo settings
- [ ] Set CODECOV_TOKEN secret in GitHub repo settings
- [ ] Push to main (triggers release.yml, which opens the version PR via changesets)
- [ ] Merge the version PR (triggers npm publish)
```

## Principles

- **Fix, don't skip.** If a phase has a gap, close it before moving to the next phase. A partial release prep is worse than no prep.
- **Verify, don't assume.** Read the actual files. Run the actual commands. Don't report a phase as done because you think it was done earlier.
- **Users first.** Changelog entries describe what users can now do, not what commits were merged.
- **Lockfile is truth.** The lock file after `ab generate` must be clean. If it is dirty, there is a mismatch between canonical and generated — investigate before shipping.