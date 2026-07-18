---
"agentsmesh": minor
---

Amazon Q: raise Hooks and Permissions from partial to embedded; add missing ledger cells for rules/project, rules/global, and mcp/global.

- **Hooks (project + global, none → partial → embedded)**: Amazon Q agent JSON files at `.amazonq/cli-agents/*.json` support a top-level `hooks` key with triggers `agentSpawn`, `userPromptSubmit`, `preToolUse`, `postToolUse`, and `stop`. Verified at https://aws.github.io/amazon-q-developer-cli/agent-format.html. Canonical `PreToolUse`, `PostToolUse`, and `UserPromptSubmit` entries are now embedded into each generated agent JSON under the corresponding Amazon Q trigger names. `Notification`, `SubagentStart`, and `SubagentStop` have no Amazon Q equivalent — `lintHooks` warns about those events only (not about the mappable ones). `generateHooks()` is a registered no-op so the engine's dispatch path finds a generator.

- **Permissions (project + global, none → partial → embedded)**: Agent JSON files support `allowedTools` (array of tool names) and `toolsSettings` (per-tool restrictions). Canonical `permissions.allow` maps directly to `allowedTools` and is now merged with per-agent tools (deduplicated) in each generated agent JSON. `deny` and `ask` have no Amazon Q equivalent — `lintPermissions` warns about those only when they are non-empty. `generatePermissions()` is a registered no-op.

- **Round-trip (importer)**: `amazonQAgentMapper` now preserves the `hooks` key from imported agent JSON into canonical agent frontmatter, completing the generate → import → generate round-trip.

- **Ledger cells (rules/project, rules/global, mcp/global)**: These three cells were absent from `capability-ledger.json` despite the descriptor declaring `rules=native` for both scopes and `mcp=native` for global scope. Added with correct paths and format metadata.

- **Hooks/permissions ledger cells**: Updated `maxAchievable` from `partial` to `embedded` for hooks and permissions in both project and global scopes.
