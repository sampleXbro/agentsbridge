# ADR: Feature Projection Policy

## Status

Accepted

## Context

Different tools support different feature families natively. Some features must be projected into alternative structures such as embedded skills or agent-like files to preserve user intent across targets.

## Decision

Represent target support with explicit capability levels:

- `native`
- `embedded`
- `partial`
- `none`

Use target metadata plus config-driven conversion flags to decide when projected behavior is active.

## Consequences

- Benefits:
  matrix output and generation logic share one support model.
- Costs:
  projected behaviors require extra round-trip logic and path rewrite coverage.
- Guardrail:
  whenever a projected feature is added or changed, update both generation and import/rewrite paths together.
