# ADR: Centralized Built-In Target Descriptor Catalog

## Status

Accepted

## Context

Target ids, capabilities, import messaging, lint hooks, skill directories, and feature routing were previously at risk of drifting across multiple files.

## Decision

Centralize built-in target metadata in `src/targets/catalog/builtin-targets.ts` and derive target catalog behavior from that source.

Core generation and matrix support query shared target metadata instead of relying on side-effect registration or duplicated target knowledge.

## Consequences

- Benefits:
  adding or changing a built-in target requires fewer coordinated edits and reduces drift risk.
- Costs:
  the descriptor file is a high-value dependency and must stay well tested.
- Guardrail:
  when target behavior moves upward into metadata, add engine-level coverage instead of relying only on target generator tests.
