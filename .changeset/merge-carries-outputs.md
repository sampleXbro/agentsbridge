---
'agentsmesh': patch
---

**`agentsmesh merge` no longer strands generated files forever.**

`resolveLockConflict` wrote the resolved `.agentsmesh/.lock` with no `outputs` key. That map is the provenance the managed-directory sweep gates on — a discovered file is deleted only when the previous lock says agentsmesh wrote it — so after a merge the sweep had nothing to go on and deleted nothing it found.

That was not a one-run deferral. A full `generate` **replaces** the outputs map with only what that run emitted, so a file generated before the merge and no longer emitted could never appear in any future map. It was never evicted, and `agentsmesh check` listed it indefinitely.

The map now carries forward as the union of both conflict sides. It records only paths agentsmesh itself wrote, so widening it can never make a foreign file deletable — it can only restore paths that were already ours. Where both sides claim the same path, ours wins; the hashes may be stale until the next generate rewrites them, which is the same state a filtered run already leaves behind and which `check` reports.

A lock with no `outputs` on either side stays without one, so an old-format lock is not silently upgraded to an empty map — `readLock` distinguishes the two and `check` relies on it.
