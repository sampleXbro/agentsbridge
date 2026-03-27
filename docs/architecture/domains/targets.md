# Targets Domain

## Responsibility

Describe each built-in tool and implement its native import, generation, and lint behavior.

## Subdomains

- `targets/catalog`
  built-in target metadata, ids, capabilities, registry/catalog lookups
- `targets/import`
  shared importer helpers
- `targets/projection`
  shared projected-agent and root-instruction helpers
- `targets/<tool>`
  tool-specific adapters

## Owns

- native file layouts and serialization
- target capability declarations
- per-target import messaging
- per-target lint constraints

## Should not own

- config loading
- canonical merge policy
- CLI orchestration

## Main architectural rule

Target metadata is the contract between `core` and `targets`. If a target-specific behavior must influence generation or matrix support, prefer encoding it in catalog metadata or shared target helpers rather than scattering target-name conditionals across the codebase.
