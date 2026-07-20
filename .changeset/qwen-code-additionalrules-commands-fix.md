---
"agentsmesh": minor
---

Qwen Code: raise global AdditionalRules to native and fix broken rule/command frontmatter keys.

- **AdditionalRules (global, embedded → native)**: non-root rules now generate real files under `~/.qwen/rules/<slug>.md` instead of being folded into `~/.qwen/QWEN.md`'s body. Qwen Code's `loadRules()` (`rulesDiscovery.ts`) reads `.qwen/rules/` recursively from **both** the global `~/.qwen` dir and the project dir with the identical mechanism, so there's no reason to embed. A new `QWEN_GLOBAL_RULES_DIR` constant, global layout rewrite, and importer-spec global source wire this up; the now-unused `renderQwenGlobalInstructions` embedding helper is removed.
- **AdditionalRules (project + global, native — fixed)**: the emitted frontmatter key for path-scoped rules changes from `globs:` to `paths:` in `.qwen/rules/<slug>.md`. Qwen Code's `parseRuleFile()` only recognizes `paths:` for conditional (turn-level lazy) rule injection — `globs:` was never read, so any canonical rule with path-scoping silently became an always-injected baseline rule. The importer's `frontmatterRemap` now maps the on-disk `paths:` key back to the canonical `globs` field so round-tripping still works.
- **Commands (project + global, native — fixed)**: the generator no longer emits `allowed-tools` into `.qwen/commands/<name>.md` frontmatter. Qwen Code's `MarkdownCommandDefSchema` (`markdown-command-parser.ts`) only maps `description`, `argument-hint`, `when_to_use`, and `disable-model-invocation` — there is no tool-restriction field, so the value was silently ignored. A new `lintCommands` warning flags canonical commands with non-empty `allowedTools` for this target.

Source: https://github.com/QwenLM/qwen-code/blob/main/packages/core/src/utils/rulesDiscovery.ts, https://github.com/QwenLM/qwen-code/blob/main/packages/cli/src/services/markdown-command-parser.ts, https://github.com/QwenLM/qwen-code/blob/main/packages/cli/src/services/FileCommandLoader.ts
