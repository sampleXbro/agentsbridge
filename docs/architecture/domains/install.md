# Install Domain

## Responsibility

Bring external content into the project as reusable extends or local materialized packs.

## Subdomains

- `install/source`
- `install/core`
- `install/manual`
- `install/native`
- `install/pack`
- `install/run`

## Owns

- source parsing and remote fetch for install
- discovery of installable resources
- selection and conflict resolution
- manifest persistence and replay
- pack materialization and sync

## Should not own

- target-native generation details
- canonical parser internals
- generic CLI routing

## Main architectural constraint

Install is allowed to orchestrate many domains, but should keep target-layout understanding delegated to importer-driven native discovery or shared target metadata, not inline heuristics.
