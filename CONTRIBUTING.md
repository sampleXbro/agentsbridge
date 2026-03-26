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
