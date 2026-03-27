# CLI Domain

## Responsibility

Expose user-facing commands and compose the underlying domains into coherent workflows.

## Main modules

- `src/cli/index.ts`
- `src/cli/router.ts`
- `src/cli/help.ts`
- `src/cli/error-handler.ts`
- `src/cli/commands/*`

## Owns

- command routing
- flag interpretation at the command level
- user-facing logging and exit behavior
- orchestration across config, canonical, core, install, and targets

## Should not own

- target-native parsing details
- canonical serialization policy
- low-level filesystem helpers
- business rules duplicated from lower domains

## Allowed dependencies

- all other domains, but only as orchestrated calls

## Main risk

Command files can become monolithic orchestration surfaces. Keep policy and low-level implementation in lower domains where possible.
