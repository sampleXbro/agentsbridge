---
"agentsmesh": minor
---

`agentsmesh check` now detects drift in generated outputs. `agentsmesh generate` records a checksum for every generated file in a new `outputs` map inside `.agentsmesh/.lock` (full runs replace the map; `--targets`/`--features` runs merge per-path), and `check` re-hashes those files, failing with exit code 1 when a generated output was hand-edited or deleted. JSON output gains `outputsModified`, `outputsRemoved`, and `outputsChecked` alongside the existing canonical-drift fields, so the two drift kinds are reported separately. A new `check --no-outputs` flag skips output verification (for setups that gitignore generated outputs in CI). Locks written by earlier versions skip output verification with a hint until the next `generate` upgrades them. The MCP `check` tool performs the same output verification. Checksums are BOM- and line-ending-normalized, so CRLF-only editor rewrites do not register as drift.
