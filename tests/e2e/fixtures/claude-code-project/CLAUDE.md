# Project Rules

## Repository workflow

- Use TypeScript strict mode.
- Use pnpm as the package manager and keep lockfile changes intentional.
- Read local docs and neighboring modules before making structural changes.

## Delivery expectations

- Keep changes focused and explain tradeoffs when touching shared code.
- Run targeted Vitest coverage for changed modules, then run `pnpm lint`.
- Update tests in the same change when behavior changes.

## Coding conventions

- All exported functions must have explicit return types.
- Prefer `unknown` plus narrowing at integration boundaries.
- Keep file-level helpers small and feature-focused.

## Review checklist

- Call out risky migration or configuration changes.
- Highlight follow-up work explicitly instead of leaving TODO comments in code.
