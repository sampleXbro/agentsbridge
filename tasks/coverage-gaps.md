# Coverage gaps (vitest `coverage.exclude`)

Each path below is excluded from branch coverage with a one-line justification. Aligns with Testing Strategy §9 and `tasks/lessons.md` (line 53).

| Path | Justification |
| --- | --- |
| `src/**/index.ts` | Re-export barrels; no branch logic. |
| `src/core/types.ts` | Types-only. |
| `src/targets/base-target.ts`, `target.interface.ts` | Interfaces only. |
| `src/targets/*/constants.ts` | Constant literals. |
| Target `linter.ts` (per target) | Thin adapters; covered via lint dispatch + matrix. |
| `src/cli/version.ts` | Dist/src path probe; low value vs churn. |
| Large importer/generator adapters | Covered by contract matrix + target-specific tests where unique. |
| `src/config/remote-fetcher.ts` | Network/cache; integration + unit stubs. |
| `src/config/lock.ts` | Heavy I/O; integration tests. |
| `src/utils/fs.ts`, `hash.ts` | Thin wrappers. |
| `src/core/result-types.ts` | Types-only. |
| Install pipeline helpers | I/O-heavy orchestration; install integration tests. |
| `src/cli/commands/watch.ts` | Async watcher; covered via harness unit + integration. |

Global branch threshold target: **87%** (Testing Strategy §9). Current gate remains **84%** until gap tests from `lessons.md` line 53 land (remote-fetcher offline, engine branches, merger, version).

Raise the threshold only when a gap closes with a tracked issue.
