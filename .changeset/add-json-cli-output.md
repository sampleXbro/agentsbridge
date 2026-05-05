---
"agentsmesh": minor
---

feat(cli): add structured JSON output mode

Adds `--json` support across CLI commands so automation and CI can consume stable machine-readable command results. JSON mode returns structured success/error envelopes while keeping the existing human-readable output as the default.
