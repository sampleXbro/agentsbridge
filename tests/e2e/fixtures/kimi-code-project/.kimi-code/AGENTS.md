# Orders API — operational notes

Kimi Code loads this file **in addition to** the repository-root `AGENTS.md`,
so keep it to facts that belong nowhere else.

- The staging database is reset every night at 03:00 UTC.
- `pnpm dev` starts the API on port 4000 with an in-memory store.
- Never point `orders-staging` at a production URL, even for a one-off check.
