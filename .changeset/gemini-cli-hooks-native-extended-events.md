---
"agentsmesh": minor
---

Gemini CLI: upgrade hooks from partial to native and extend canonical↔Gemini hook event mapping to all supported events.

- **Hooks (project + global): partial → native**. Gemini CLI reads hooks natively from `.gemini/settings.json` (project) and `~/.gemini/settings.json` (global), confirmed against upstream `settingsSchema.ts`. Both scopes are file-writable with full round-trip support.

- **Extended hook event mapping**: the generator and importer previously mapped only 3 events (PreToolUse↔BeforeTool, PostToolUse↔AfterTool, Notification↔Notification). Gemini CLI's schema defines 11 hook events; 6 now have canonical equivalents and are fully wired:

  | Canonical (agentsmesh) | Gemini CLI |
  |---|---|
  | `PreToolUse` | `BeforeTool` |
  | `PostToolUse` | `AfterTool` |
  | `Notification` | `Notification` |
  | `SubagentStart` | `BeforeAgent` *(new)* |
  | `SubagentStop` | `AfterAgent` *(new)* |
  | `SessionStart` | `SessionStart` *(new)* |

  The 5 Gemini-only events (`SessionEnd`, `PreCompress`, `BeforeModel`, `AfterModel`, `BeforeToolSelection`) have no canonical equivalent and are silently dropped on import, as before for any unmapped event. The lint `supported` list is updated to match; `SubagentStart`, `SubagentStop`, and `SessionStart` no longer produce spurious unsupported-event warnings.
