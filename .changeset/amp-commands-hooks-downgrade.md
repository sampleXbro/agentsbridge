---
"agentsmesh": minor
---

Amp: downgrade Commands to embedded and Hooks to none (fabricated capabilities).

- **Commands (project + global, native → embedded)**: Amp has no declarative slash-command file format — per https://ampcode.com/manual, commands only exist via `amp.registerCommand(...)` inside a TypeScript plugin. `generateCommands()` already projected each command as `.agents/skills/<name>/SKILL.md` (the same embedding `generateSkills` uses natively), so the generated output is unchanged; only the declared capability level is corrected from `native` to `embedded`.
- **Hooks (project + global, native → none)**: `buildAmpScopedSettings()` used to write an undocumented `"amp.hooks"` key into `.amp/settings.json`. Re-verified directly against ampcode.com/manual (live full-page render, plus 14+ months of Wayback Machine snapshots from May 2025 through Jul 2026) — the word "hooks" never appears anywhere in the manual's content. Amp's only hook-like mechanism is the plugin-based `amp.on(...)` event API (code, not a declarative settings file), so there is no achievable level above `none`. `buildAmpScopedSettings()` no longer emits `amp.hooks`, `mergeAmpSettings()` no longer special-cases the key, and a new `lintHooks` warns when canonical hooks exist but can't be projected (mirroring the existing `lintIgnore` pattern).
- Updated `src/targets/catalog/capability-ledger.json`: `amp/commands/project` confirmed at `embedded`; `amp/hooks/project` and `amp/hooks/global` marked `rejected` (previously fabricated `native` claim).
