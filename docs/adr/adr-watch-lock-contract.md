# ADR: Watch And Lock Contract

## Status

Accepted

## Context

`watch` combines filesystem events, regeneration, and `.agentsmesh/.lock` writes. Aggregate test runs showed that startup timing and lock-file churn can easily produce self-trigger loops or missed edits if the contract is loose.

## Decision

Treat watch mode as a conservative wrapper around generate:

- wait for chokidar readiness before the initial generate
- ignore self-generated lock-file churn, including parent directory events
- debounce canonical/config changes
- refresh matrix only when the feature fingerprint changes

## Consequences

- Benefits:
  watch behavior is predictable and avoids self-trigger storms.
- Costs:
  watch mode remains intentionally simple and should not accumulate unrelated orchestration.
- Guardrail:
  any watcher change must be validated in both the isolated watch suite and the full `pnpm test` run.
