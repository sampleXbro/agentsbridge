---
"agentsmesh": minor
---

Trae: fix agents round-trip, raise hooks to native, add full test coverage.

- **Agents (project + global, native — fixed)**: `.trae/agents/<name>.md` files are now imported back via the descriptor importer (`preset: 'agent'`). The `importer` block previously had no `agents` key, so `agentsmesh import` silently dropped every agent file written by `agentsmesh generate`, breaking every generate→edit→import round-trip. Project agents import from `.trae/agents/`, global agents from `.trae-cn/agents/` (Trae CN edition). A canonical `TRAE_CANONICAL_AGENTS_DIR` constant and `importer-spec.ts` module were added.

- **Hooks (project + global, partial → native)**: Trae's official documentation (docs.trae.cn/ide_hook-configuration-reference) confirms a fully writable file-based hook system. Project hooks live at `$PROJECT/.trae/hooks.json`; global hooks at `~/.trae-cn/hooks.json` (macOS/Linux). Both use a flat JSON schema: `{ "version": 1, "hooks": { "<Event>": [{ "matcher", "type", "command", "timeout"? }] } }`. `generateHooks` now serialises canonical command-type hooks to this format; `importHooks` in `importer.ts` reads them back into `hooks.yaml`. Prompt/agent hook types are dropped on both sides for a symmetric round-trip. The previous partial-level `lintHooks` warning is removed.

- **Test coverage added**: `generateAgents` unit tests (path, frontmatter fields, tools conditional, model conditional, empty-array short-circuit, body trim); `generateHooks` unit tests (null, empty, single event, multi-event, timeout omit, prompt-drop); `rewriteGeneratedPath` tests for agents (`.trae/agents/` → `.trae-cn/agents/`) and hooks (`.trae/hooks.json` → `.trae-cn/hooks.json`); project and global agentPath tests in `descriptor-paths.test.ts`; agents + hooks import round-trip tests in `importer.test.ts` for both project and global scope.

- **File size**: `index.ts` (was 205 lines) refactored to delegate the importer spec to `importer-spec.ts`, bringing it to 181 lines (within the 200-line rule).
