# ADR: Canonical Source Of Truth

## Status

Accepted

## Context

AgentsMesh synchronizes many target-native formats with different structures, frontmatter conventions, and capability sets. Without one normalized internal model, import and generate behavior drift quickly and round-tripping becomes lossy.

## Decision

Use `.agentsmesh/` as the single canonical project representation and treat all target-native files as generated artifacts or import sources.

Canonical state is loaded into one `CanonicalFiles` graph, then projected to targets through the core engine and target adapters.

## Consequences

- Benefits:
  one merge model, one validation model, one lock/checksum model, and one place to reason about collaboration.
- Costs:
  every target import path must normalize faithfully into canonical form, and generated root decoration must be stripped back out on import.
- Guardrail:
  direct edits should happen in `.agentsmesh/` first whenever that feature exists canonically.
