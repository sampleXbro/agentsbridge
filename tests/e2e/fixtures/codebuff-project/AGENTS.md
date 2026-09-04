# Orders API

Node service that exposes the order lifecycle over HTTP and persists to Postgres.

## Working agreements

- Write the failing test first, then the implementation.
- Keep route handlers thin: validation in `src/routes`, business logic in `src/db`.
- Never widen a type to `any`; narrow from `unknown` instead.
- Run `pnpm test` before proposing a change.

## Layout

- `src/routes` — HTTP handlers and request validation
- `src/db` — query builders and migrations
