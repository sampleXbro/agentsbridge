---
'agentsmesh': patch
---

**A comment in your config no longer costs you the whole file.**

Five mergers parsed the user's file with `JSON.parse` and coerced an unparsable base to `{}` before serialising their own keys over the top. One `//` line was enough to lose everything else in the file:

```jsonc
// before
{
  // my editor prefs
  "editor.fontSize": 14,
  "files.exclude": { "**/.git": true }
}

// after `agentsmesh generate` with roo-code enabled
{
  "roo-cline.allowedCommands": ["Bash(ls)"]
}
```

This was live on files that are comment-legal by design: `.vscode/settings.json` (VS Code ships its own settings commented), `kilo.jsonc` (the format's name is JSON-with-comments), `.qwen/settings.json`, and the shared `.claude/settings.json` / `.gemini/settings.json` / `crush.json` mergers.

All five now preserve a base they cannot parse, via one shared guard (`preservedUnparsableBase`). That is the rule `mergeOwnedJsonKeys` already followed — these sites simply never routed through it.

The trade-off is unchanged and deliberate: on a commented file, agentsmesh writes nothing and reports the path as `unchanged`, so generated content is silently not applied there. Preserving a file we cannot safely rewrite beats destroying it, but the run gives no warning yet.

Eleven existing tests asserted the old behaviour — names like "falls back to `{}` when the base JSON is invalid" and "replaces invalid existing settings.json". They encoded the data loss as intended behaviour and were rewritten to the new contract rather than removed.
