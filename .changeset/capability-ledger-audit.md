---
"agentsmesh": minor
---

Add a capability provenance ledger (`src/targets/catalog/capability-ledger.json`) plus deterministic `pnpm capabilities:audit` / `capabilities:seed` and a CI conformance test that validates each target's generated files against a recorded path/extension/structure fingerprint. Reworks the `update-target-capabilities` skill to an audit-driven flow.
