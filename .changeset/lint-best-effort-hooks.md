---
'agentsmesh': patch
---

Lint no longer warns about agentsmesh-injected best-effort hook events

`agentsmesh lint` previously flagged the recall/capture hook events agentsmesh itself injects (`UserPromptSubmit`, `PostToolUseFailure`, `SessionStart`) as "unsupported" on targets whose hook model can't represent them — an unactionable warning, since agentsmesh injects those events and degrades them gracefully. They are now excluded from the unsupported-hook warning across every whitelist-style target.
