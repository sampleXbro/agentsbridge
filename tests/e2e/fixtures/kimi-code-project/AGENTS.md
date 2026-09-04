# Orders API

Node 22 + TypeScript service that fulfils customer orders. Everything ships from
`src/`; the HTTP layer lives in [src/server/routes.ts](src/server/routes.ts).

## Working agreement

- Run `pnpm test` before every push; a red suite blocks the merge.
- Migrations are additive only — never drop a column in the same release that stops writing it.
- Ask before adding a dependency; we vendor small helpers instead.

## Where things live

- Route scaffolding is automated by [.kimi-code/skills/api-generator/SKILL.md](.kimi-code/skills/api-generator/SKILL.md).
- Diff review is delegated to [.kimi-code/agents/code-reviewer.md](.kimi-code/agents/code-reviewer.md).

<!-- agentsmesh:embedded-rules:start -->
<!-- agentsmesh:embedded-rule:start {"source":"rules/typescript.md","description":"TypeScript standards","globs":["src/**/*.ts"],"targets":[]} -->
## TypeScript standards
- `strict` stays on; no `any`, use `unknown` plus a narrowing guard.
- Public functions carry an explicit return type.
- Prefer `interface` for object shapes so declaration merging stays available.
<!-- agentsmesh:embedded-rule:end -->
<!-- agentsmesh:embedded-rule:start {"source":"rules/sql.md","description":"Database access","globs":["src/db/**/*.ts"],"targets":["kimi-code"]} -->
## Database access
- Every query goes through the repository layer; no raw SQL in route handlers.
- Wrap multi-statement writes in a transaction and assert the row count.
<!-- agentsmesh:embedded-rule:end -->
<!-- agentsmesh:embedded-rules:end -->
