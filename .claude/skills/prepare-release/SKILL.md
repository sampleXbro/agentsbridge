---
name: prepare-release
description: "Use this skill whenever preparing agentsmesh for an npm release — whether first publish, patch, minor, or major. Triggers on: 'prepare release', 'ready to publish', 'ship version', 'release prep', 'get this to npm', 'bump version', 'cut a release', 'what's needed to publish'. Runs a strict ordered checklist: test suite health → timing hardening → CI/CD presence → community health files → changesets → CHANGELOG quality → package contents → README badges → final gate → generate to targets. Do not skip this or work from memory — execute every phase in order and fix gaps before moving on."
---

## Purpose

# Prepare Release

You are acting as the release engineer for agentsmesh. Your job is to get the repo into a state that is safe, honest, and ready for `npm publish`. Work through each phase in order. Do not mark a phase complete until you have verified it, not just assumed it.

## How publishing works

Publishing is fully automated via changesets. The flow is:

1. All phases below pass locally
2. Commit the pending `.changeset/*.md` file and push to `master`
3. `publish.yml` triggers — changesets/action detects pending changesets and **opens a "chore: version packages" PR** that bumps `package.json` and updates `CHANGELOG.md`
4. Review and **merge the version PR** → `publish.yml` triggers again — changesets/action sees no pending changesets, runs `pnpm release` (`pnpm build && changeset publish`), and publishes to npm via npm trusted publishing
5. GitHub creates a Release and tag automatically

Prerequisites in GitHub repo settings:
- **Settings → Actions → General → Workflow permissions**: enable "Allow GitHub Actions to create and approve pull requests"
- **npm package settings → Trusted publishers**: add this repository/workflow for the `agentsmesh` package so GitHub Actions OIDC can publish without `NPM_TOKEN`

---

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
| `tests/integration/watch.integration.test.ts` | startup `waitForFile` timeout | ≥ 15000 ms |
| `tests/integration/watch.integration.test.ts` | post-change `setTimeout` | ≥ 1500 ms |
| `tests/e2e/watch.e2e.test.ts` | startup `setTimeout` | ≥ 3000 ms |
| `tests/e2e/watch.e2e.test.ts` | post-change `setTimeout` | ≥ 1500 ms |

Also verify `vitest.config.ts` has global guards:

```ts
testTimeout: 15_000,
hookTimeout: 10_000,
```

If any of these are missing or too low, update them now. The watch debounce is 300 ms plus generate time; tight timeouts that work on a fast local machine will fail on a 2-core CI runner.

---

## Phase 2 — CI/CD Workflows

Check that both workflow files exist and are correct:

- `.github/workflows/ci.yml` — runs on every push and PR to `master`
- `.github/workflows/publish.yml` — runs changesets publish flow on push to `master`

### ci.yml must include these steps in order

1. `pnpm install --frozen-lockfile`
2. `pnpm audit --prod --audit-level=high` — catches high/critical vulns in production deps only
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm test:coverage` with Codecov upload (`fail_ci_if_error: false` so fork PRs don't break)
7. `pnpm build`
8. `pnpm test:e2e` — must come after build; e2e runs `dist/cli.js`

Use Node 22 + pnpm 10 + `cache: pnpm` in `setup-node`. Never run e2e in parallel with build — they share `dist/`. Both workflows must have `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at the job level to suppress the Node 20 deprecation warning.

### publish.yml must use changesets/action@v1 and trigger on push to master

```yaml
on:
  push:
    branches: [master]

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    env:
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: "https://registry.npmjs.org"
      - name: Upgrade npm for trusted publishing
        run: npm install -g npm@latest
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Create release PR or publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
          title: "chore: version packages"
          commit: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The job needs `id-token: write` for npm trusted publishing/provenance and `pull-requests: write` to create the version PR. If either file is missing or malformed, create/fix it now.

---

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

---

## Phase 4 — Changesets Setup

Verify changesets is configured correctly:

1. `.changeset/config.json` exists with `"access": "public"` and `"baseBranch": "master"`
2. `@changesets/cli` is in `devDependencies` in `package.json`
3. `package.json` has these scripts:
   ```json
   "changeset": "changeset",
   "version": "changeset version",
   "release": "pnpm build && changeset publish"
   ```
4. Lockfile is up to date (`pnpm install` has been run)

### Changeset for this release

If there is no pending changeset file in `.changeset/` (nothing other than `config.json`):

```bash
pnpm changeset
```

Follow the prompts: select the bump type (patch/minor/major), write a one-line user-facing summary. Commit the resulting `.changeset/*.md` file. The `publish.yml` workflow will consume it on the next push to `master`.

If a changeset already exists, confirm it describes the changes accurately before proceeding.

---

## Phase 5 — CHANGELOG

Open `CHANGELOG.md`. The entry for the version being released must:

- Have the real date (`YYYY-MM-DD`), not `TBD`
- Cover every major user-facing addition since the previous release
- Be written for users, not for commit archaeology — describe the capability, not the implementation

### Required sections for a first-ever release

Group under clear subheadings:

- **CLI commands** — one line per command: what it does, key flags
- **Supported targets** — comma-separated list
- **Canonical features** — rules, commands, agents, skills, mcp, hooks, ignore, permissions
- **Config** — describe `agentsmesh.yaml`, `agentsmesh.local.yaml`, `.agentsmesh/`, `.lock`
- **Extends** — local and remote forms with example syntax
- **Link rebasing** — one sentence on what it does
- **Collaboration** — lock file, `check`, `merge`

For subsequent releases (patch/minor/major), follow Keep a Changelog format with Added / Changed / Fixed / Removed sections.

---

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

Source files, test files, fixtures, `.agentsmesh/`, `docs/`, `tasks/`, and `tsconfig.json` must not appear. The `files` field in `package.json` controls this — it should be:

```json
"files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"]
```

If unexpected files appear in the pack output, add them to `.npmignore` or tighten the `files` field.

---

## Phase 7 — README Badges

The README must have these four badges immediately after the `# AgentsMesh` heading:

```markdown
[![CI](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/sampleXbro/agentsmesh/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentsmesh.svg)](https://www.npmjs.com/package/agentsmesh)
[![Coverage](https://codecov.io/gh/sampleXbro/agentsmesh/branch/master/graph/badge.svg)](https://codecov.io/gh/sampleXbro/agentsmesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

The CI badge will show "passing" once the first CI run completes. The npm version badge shows the published version; it will display correctly once the package is on the registry. Coverage requires a `CODECOV_TOKEN` secret set in GitHub repo settings.

---

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

---

## Phase 9 — Generate to All Targets

Once all phases pass, sync the canonical config to every configured target:

```bash
node dist/cli.js generate
```

This rewrites to Claude Code, Cursor, Copilot, Gemini CLI, Cline, Codex CLI, Windsurf, Continue, and Junie in their native formats. Verify the lock file updates cleanly with no unexpected diffs. Commit any changes.

---

## Output

After all phases, produce a release readiness report:

```markdown
## Release Readiness — agentsmesh v{version}

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
- [ ] Ensure "Allow GitHub Actions to create and approve pull requests" is enabled in repo Settings → Actions → General
- [ ] Ensure npm package trusted publisher settings point to this repository and `.github/workflows/publish.yml`
- [ ] Ensure `CODECOV_TOKEN` secret is set (for coverage badge)
- [ ] Push to master → changesets/action opens the "chore: version packages" PR
- [ ] Review and merge the version PR → changesets/action publishes to npm automatically
```

---

## Principles

- **Fix, don't skip.** If a phase has a gap, close it before moving to the next phase. A partial release prep is worse than no prep.
- **Verify, don't assume.** Read the actual files. Run the actual commands. Don't report a phase as done because you think it was done earlier.
- **Users first.** Changelog entries describe what users can now do, not what commits were merged.
- **Lockfile is truth.** The lock file after `generate` must be clean. If it is dirty, there is a mismatch between canonical and generated — investigate before shipping.