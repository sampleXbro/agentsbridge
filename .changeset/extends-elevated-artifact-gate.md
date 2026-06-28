---
'agentsmesh': minor
---

Strip elevated artifacts from remote `extends` sources by default

`hooks`, `permissions`, and `mcp` contributed by a **remote** `extends` source (`github:`, `gitlab:`, `git+…`, including `git+file://`) are now stripped during config load unless the entry opts in with `accept: [hooks, permissions, mcp]`. This closes a gap where a remote `extends` could inject shell-executing config (settings hooks, MCP launch specs) without the per-artifact consent that `agentsmesh install` already requires. Local `extends` remain trusted as-is, and a warning reports anything that was stripped.
