---
name: typescript-quality-gates
description: Use when validating build quality, tsconfig rules, declaration output, linting, package integrity, or CI gates for a TypeScript library.
---

## Purpose

# TypeScript Quality Gates

You are responsible for enforcing high-confidence quality gates for a production TypeScript library.

## Goals

- Catch correctness, typing, packaging, and compatibility issues before release.
- Keep CI fast but meaningful.
- Prevent invalid declaration output and broken package metadata.
- Enforce standards that matter for consumers, not cosmetic noise.

## Required baseline checks

Every substantial change should be evaluated against these gates:

1. Typecheck
   - `tsc --noEmit` or equivalent project validation
   - zero unresolved type errors

2. Build
   - production build succeeds
   - declaration files emit correctly
   - output structure matches `package.json` exports

3. Lint
   - enforce correctness-focused linting
   - avoid excessive stylistic churn unless the repo explicitly wants it

4. Tests
   - unit/integration/type tests pass

5. Package verification
   - inspect the packed artifact using `npm pack --dry-run` or equivalent
   - confirm only intended files ship
   - verify README, LICENSE, declaration files, and dist outputs are present

## tsconfig expectations

Prefer strict settings for libraries.

Recommended expectations:
- `strict: true`
- `noImplicitOverride: true` where applicable
- `noUncheckedIndexedAccess: true` when practical
- `exactOptionalPropertyTypes: true` when the API benefits from tighter semantics
- `declaration: true`
- `declarationMap: true` when useful for debugging
- `sourceMap: true` for distributed debugging if desired
- `skipLibCheck` may be tolerated for CI speed, but do not use it to hide library issues in authored code

## Declaration quality rules

Validate that emitted `.d.ts` files:
- resolve successfully for consumers
- do not reference private/internal paths
- do not leak unstable implementation details unnecessarily
- align with documented public API
- remain readable enough for IDE usage

## Packaging integrity rules

Check:
- `exports` map matches real files
- `types` path exists and is correct
- `bin` targets exist and are executable when applicable
- `files` whitelist is accurate
- `sideEffects` is correct
- `engines` reflects actual compatibility

## Anti-patterns to flag

- shipping source-only packages accidentally
- broken export paths
- mismatched ESM/CJS entrypoints
- hidden reliance on ts-node or test-only runtime behavior
- declaration output that references `../../../src/` internals
- publishing unnecessary fixtures, screenshots, or test artifacts
- broad `any` in public API without explicit justification
- unstable inferred return types in exported functions

## CI recommendations

For PR validation, prefer a pipeline like:
1. install
2. lint
3. typecheck
4. test
5. build
6. package verification

For release validation, additionally verify:
- version/changelog consistency
- smoke-test installation in a fresh temp project
- Node version matrix where relevant

## Output format

When auditing changes, return:
1. Failed gates
2. Risk level
3. Exact fixes
4. Suggested CI commands

Favor hard release confidence over superficial cleanliness.