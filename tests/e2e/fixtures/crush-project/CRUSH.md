# Project Guidelines

This project uses TypeScript with strict mode enabled. Always write tests before implementing features (TDD).

## Architecture

- Use pure functions over classes unless state is required
- Keep files under 200 lines; split by responsibility
- Prefer `unknown` over `any` in TypeScript

## Code Quality

- Run `pnpm lint` and `pnpm typecheck` before submitting changes
- All public functions must have explicit return types
- Use `interface` over `type` for object shapes

<!-- agentsmesh:managed-rules -->
<!-- agentsmesh:managed-rules-end -->
