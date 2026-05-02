---
description: Review the staged changes for correctness and style
---

Review the currently staged changes. For each touched file:

1. Confirm the public API contract still holds.
2. Check tests cover the changed behaviour, not just the happy path.
3. Flag any TODOs, panic-prone branches, or silent error swallows.

Report findings with severity: critical, warning, suggestion.
