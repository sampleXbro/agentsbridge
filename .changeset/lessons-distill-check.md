---
'agentsmesh': minor
---

Add `agentsmesh distill` CLI command — the encapsulated interface for the
lessons recall + capture subsystem. Three modes:

```bash
agentsmesh distill            # propose routing for unrouted journal bullets
agentsmesh distill --apply    # record reviewed decisions in the ledger
agentsmesh distill --check    # assert every bullet is routed; exits 1 if not
```

No package-manager assumption, no scripts to copy. Consumers wire
`agentsmesh distill --check` into whatever hook system they prefer (husky,
lefthook, simple-git-hooks, plain `.git/hooks`) or a CI step — a failed
check forces the developer or agent to distill the bullet (or explicitly
mark it `skip`) before the commit lands. The one hard guarantee in the
subsystem: captured lessons cannot be silently dropped.

The procedural rule in `_root.md` (projected to every target's root file)
now references `agentsmesh distill` instead of `pnpm distill:*`, making the
subsystem fully self-contained — consumers need only the `agentsmesh`
binary.

Public API additions (`agentsmesh/lessons`):

- `proposeDistill(paths): ProposeDistillResult`
- `applyDistill(paths): ApplyDistillResult`
- `checkJournalCoverage(paths): CheckJournalResult`
- `ProposalEntry`, `ProposeDistillResult`, `ApplyDistillResult`,
  `CheckJournalResult`, `UnroutedBullet` types
