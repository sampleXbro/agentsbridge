---
'agentsmesh': patch
---

Fixed: the MCP server's `generate` tool now persists `.agentsmesh/.lock`. It previously reimplemented file-writing and skipped the lockfile (while still reporting `lockfileUpdated: true`), which left `agentsmesh check` permanently drifted in CI for projects that generate through the MCP server. The handler now delegates to the same path as `agentsmesh generate`, so it writes target files, cleans stale outputs, and updates the lock identically.
