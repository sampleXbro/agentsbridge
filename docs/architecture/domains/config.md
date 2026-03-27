# Config Domain

## Responsibility

Load config, validate schema, resolve local and remote extends, and manage collaboration lock state.

## Subdomains

- `config/core`
  schema, conversions, config loader, lock logic
- `config/remote`
  remote source parsing and fetch behavior
- `config/resolve`
  native-format detection and resolved extend paths

## Owns

- `agentsmesh.yaml` and `agentsmesh.local.yaml` parsing
- `ValidatedConfig`
- extend source resolution
- `.agentsmesh/.lock` read/write/checksum behavior

## Should not own

- canonical merge policy
- target-specific generation/import logic
- CLI-specific messaging beyond actionable thrown errors

## Allowed dependencies

- `utils`
- `core/types`
- narrowly, `install/pack` cache cleanup today

## Notes

The current `config -> install/pack/cache-cleanup` dependency is acceptable but not ideal. If cache management grows, it should likely move into a neutral cache utility or a dedicated config/cache subdomain.
