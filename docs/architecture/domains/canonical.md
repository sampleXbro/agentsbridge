# Canonical Domain

## Responsibility

Represent project state in one normalized internal format and merge all canonical sources into a single `CanonicalFiles` graph.

## Subdomains

- `canonical/features`
  parsers for rules, commands, agents, skills, mcp, permissions, hooks, ignore
- `canonical/extends`
  extend loading, feature filtering, pick behavior, merge order
- `canonical/load`
  local canonical loading, pack loading, merge helpers

## Owns

- canonical parsing rules
- merge semantics between extends, packs, and local canonical files
- feature filtering and extend-pick narrowing

## Should not own

- target output paths
- CLI side effects
- install source parsing

## Merge order

1. resolved extends in declared order
2. materialized packs
3. local `.agentsmesh/`

Local canonical files always win last.
