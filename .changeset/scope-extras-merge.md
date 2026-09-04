---
'agentsmesh': patch
---

**Global-scope generation no longer replaces user config files it only partly owns.**

`scopeExtras` — the hook targets use for global-only outputs — pushed its results straight onto the result list, bypassing the shared merge policy that every other emission path goes through. Six paths were rewritten from canonical alone:

- `~/.continue/config.yaml` — Continue's personal assistant config. The first `generate --global` erased the user's `models` blocks (**including `apiKey` / `apiBase`**), `context` providers, `docs`, hand-written rules and prompts, and overwrote the assistant `name` with the literal `agentsmesh`.
- `~/.continue/permissions.yaml` — the approval cache Continue writes when the user picks "always allow" / "always ask" / "exclude".
- `~/.copilot/mcp-config.json` — servers registered with `copilot mcp add`.
- `~/.gemini/policies/permissions.toml`
- `~/.deepagents/hooks.json`
- `~/.roo/settings/custom_modes.yaml`

`scopeExtras` results now route through the same `mergeOutputContent` policy as the feature loop, with pending-result dedup. Targets whose file needed key-scoped ownership gained a `mergeGeneratedOutputContent` hook; the affected paths moved to `managedOutputs.coOwnedFiles` so stale cleanup cannot delete them either.

Reading the existing file is not the same as merging it. `~/.copilot/mcp-config.json` was read on every run — but only to decide whether to report "created" or "updated", never as a merge base. Any audit of this class has to check whether the existing content reaches the emitted content, not whether the file was opened.

Two related merge fixes, each its own silent data loss:

- `mergeSettingsJson` now merges *inside* `permissions`, so the user's `defaultMode` and `additionalDirectories` survive a write instead of being dropped every time agentsmesh wrote allow/deny/ask.
- `mergeCrushConfigJson` now merges inside `permissions` and `options`, so `options.debug` survives.

**`agentsmesh init` no longer scaffolds `allow: []` / `deny: []` / `ask: []`.** Those keys are commented-out examples now. An explicit empty list is a real instruction — "grant nothing" — not a placeholder, and targets that project permissions into a shared config file apply it. A user adopting agentsmesh with existing permissions in `.claude/settings.json` would have had them cleared. Absent keys mean "agentsmesh manages nothing here yet", which is what a fresh init actually means.

**Known gap, unchanged by this release:** emptying a canonical list still does not revoke what a previous run wrote into a co-owned file. Co-owned files are never deleted (that is deliberate — deleting them is what destroyed real user configs), so an emptied `allow` leaves the previously written grant live. Per-entry revocation works; only revocation-to-empty does not. A first attempt at this was withdrawn before release: without a record of what agentsmesh previously wrote, revocation cannot distinguish its own output from the user's, and it cleared permissions the user had authored by hand. Doing it properly needs provenance tracking.
