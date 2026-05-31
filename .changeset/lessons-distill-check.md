---
'agentsmesh': patch
---

Add `pnpm distill:check` — a hard gate that fails when
`.agentsmesh/lessons/journal.md` contains bullets not yet routed in
`distill-ledger.yaml` (or explicitly marked `skip`).

Wired into the project's husky pre-commit chain so an agent or
developer cannot land a commit that captures a lesson without also
distilling it. Recommended as a CI gate on consumer projects: drop
`pnpm distill:check` into the build before merge.

Public API additions (`agentsmesh/lessons`):

- `checkJournalCoverage(paths): CheckJournalResult` — pure function that
  returns the routed vs unrouted breakdown; callers decide how to
  surface (CLI exit, CI annotation, custom UI).
- `CheckJournalResult`, `UnroutedBullet` types.
