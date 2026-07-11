# Contributing to AgentsMesh

## Prerequisites

- Node.js 20 or later
- pnpm 10 or later

## Setup

```bash
git clone https://github.com/sampleXbro/agentsmesh.git
cd agentsmesh
pnpm install
```

## Development workflow

```bash
pnpm build          # compile src/ → dist/
pnpm test           # unit + integration tests
pnpm test:e2e       # end-to-end tests (requires build)
pnpm test:coverage  # coverage report
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm format         # prettier
```

Always run `pnpm build` before `pnpm test:e2e` — e2e tests execute `dist/cli.js` directly.

## Rules

- **TDD mandatory**: write a failing test first, then implement.
- **Max file size**: 200 lines. Split by responsibility if larger.
- **No `any`**: use `unknown` + narrowing.
- **No classes unless stateful**: prefer pure functions + types.
- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/): `feat|fix|test|refactor|docs|chore(scope): message`.

## Adding a new target

Use the `add-agent-target` skill documented in `.claude/skills/add-agent-target/`. It requires:
- Current official documentation research for the target format
- Full importer and generator implementation
- Realistic fixtures
- Complete unit, integration, and e2e coverage
- Matrix and docs updates

## Pull requests

- Keep PRs small and focused on one change.
- All CI checks must pass (`pnpm test`, `pnpm lint`, `pnpm typecheck`).
- Add a changeset (`pnpm changeset`) for any user-visible change.

## Reporting bugs

Open a GitHub issue with a minimal reproduction case. See [SECURITY.md](SECURITY.md) for security vulnerabilities.

### Updating target capabilities

Capability provenance lives in `src/targets/catalog/capability-ledger.json` — an *oracle* that validates descriptors; it never generates. Current capability levels always come from each target's `capabilities.ts` (the matrix derives from there); the ledger records where the tool's own docs say each file/shape is, so generated output can be validated against it.

Maintainer commands:

- `pnpm capabilities:audit` — join descriptors × ledger and print three buckets: **GAPS** (descriptor below the researched ceiling — raise-opportunities), **STALE** (provenance null/expired, or descriptor over-declares), **MISSING** (a native/embedded cell with no ledger provenance yet).
- `pnpm capabilities:audit --json` / `--stale <days>` — machine-readable output / override the staleness window (default 180).
- `pnpm capabilities:seed` — regenerate fingerprint skeletons from current generator output (run after adding or changing a native/embedded feature). Seeds only project-scope, single-structured-file cells; directory/projection features (commands/agents/skills) and extensionless ignore files are left for manual research.
- `pnpm capabilities:verify` — reports native/embedded cells that still lack ledger provenance. This is a **backlog tracker**, not a CI gate: many cells are intentionally un-researched, so it currently exits non-zero.

The enforced gate is the conformance test in `tests/contract/capability-ledger-conformance.test.ts` (runs under `pnpm test`, hence in CI): every seeded native/embedded cell is generated and its output must match the recorded extension, serialization, and structural fingerprint. A declared-native cell whose output drifts (wrong path/key/shape/extension) fails CI.

Use the `update-target-capabilities` skill to drive research on the flagged STALE/MISSING cells and to flip GAPS.
