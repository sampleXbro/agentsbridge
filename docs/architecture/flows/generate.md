# Generate Flow

`agentsmesh generate` is the primary projection pipeline from canonical state to target artifacts.

## Entry point

- CLI command:
  `src/cli/commands/generate.ts`
- Core engine:
  `src/core/generate/engine.ts`

## Sequence

```mermaid
sequenceDiagram
  participant CLI as generate command
  participant CFG as config loader + lock
  participant CAN as canonical loader
  participant ENG as core engine
  participant FS as filesystem

  CLI->>CFG: loadConfigFromDir()
  CLI->>CFG: readLock() / validate locked features
  CLI->>CAN: loadCanonicalWithExtends()
  CLI->>ENG: generate(config, canonical, targetFilter)
  ENG->>ENG: feature loops + optional features
  ENG->>ENG: rewrite references + decorate roots + resolve collisions
  CLI->>FS: write changed target files
  CLI->>CFG: writeLock()
```

## Inputs

- `agentsmesh.yaml`
- `agentsmesh.local.yaml`
- `.agentsmesh/`
- resolved extends
- materialized packs under `.agentsmesh/packs/`

## Outputs

- target-native files and directories
- `.agentsmesh/.lock`
- optional `.agentsmeshcache` symlink

## Important rules

- lock strategy `lock` blocks generation unless `--force` is supplied when locked canonical features changed
- `--check` does not write files
- `--dry-run` reports planned writes without touching the filesystem
- feature generation is target-capability-aware and routed through built-in target metadata

## Failure points

- invalid config or missing config
- locked feature violations
- unsafe output paths
- target collision resolution producing conflicting artifacts
- filesystem write failures

## Architectural reason this flow matters

This is the central library contract. Every other workflow either feeds canonical state into this flow or validates the results of this flow.
