---
"agentsmesh": patch
---

Reject MCP read, write, and delete paths that escape the project directory through symlinks. Containment is anchored at the project root (not `.agentsmesh`), so a symlinked config file **or** a symlinked `.agentsmesh` parent directory can no longer leak or overwrite files outside the project. Covers skill and canonical (rules/commands/agents) list/get/create/update/delete, plus all config reads and writes (`get_config`/`update_config`, permissions, hooks, ignore, and MCP-server tools). Note: config reads that escape through a symlink now raise `PATH_TRAVERSAL` instead of returning `null`.
