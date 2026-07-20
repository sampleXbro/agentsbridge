---
"agentsmesh": patch
---

Fix capability-ledger engine: preserve researched maxAchievable ceilings and full fingerprints during merge, report over-declared cells independently from unverified.

- `scripts/merge-capability-ledger.ts`: fix two data-loss bugs — (1) confirmed/rejected cells now keep their researched `maxAchievable` ceiling instead of being overwritten by the descriptor level; (2) fingerprint preservation now checks all three arrays (topLevelKeys, requiredFrontmatter, keyChecks), not just topLevelKeys, so manually-added keyChecks and requiredFrontmatter entries are no longer silently wiped.
- `src/core/capabilities/merge.ts`: extract merge logic into a pure, unit-tested module (`mergeCell`, `hasNonEmptyFingerprint`). `pnpm capabilities:merge` is now a registered script.
- `src/core/capabilities/audit.ts`: report `over-declared` independently from `unverified` — a cell with `verifiedAt=null` and a descriptor that exceeds its `maxAchievable` now appears in the stale bucket with both reasons rather than masking the over-declared signal.
