---
'agentsmesh': patch
---

fix: six correctness bugs surfaced by a full feature review

- **lessons recall on symlinked roots**: `normalizeRecallFile` now realpaths the
  project root and an absolute `--file` before relativizing. The CLI derives the
  root from the physical `process.cwd()` while harnesses pass logical paths
  (macOS `/tmp` → `/private/tmp`), so on a symlinked checkout `relative()`
  escaped the root and recall — including the PostToolUse recall hook — silently
  matched zero lessons. Recall now resolves correctly.
- **MCP lessons tools error codes**: failures (unknown topic, predicate-less
  query, unknown lesson id, capture-guardrail rejections) now return
  `NOT_FOUND` / `VALIDATION_FAILED` with the domain code in `details`, instead of
  mislabeling every failure as `IO_ERROR`.
- **`generate` scoped-settings feature gating**: disabling a feature (e.g. `mcp`)
  no longer leaks it into the gemini / zed / amp / augment `settings.json`
  sidecars — `emitScopedSettings` is now gated by the enabled-feature set, for
  plugin descriptors as well as builtins.
- **`matrix --global` accuracy**: targets without `globalSupport` (cloud-only
  Jules, Replit Agent) now report `none` in global scope instead of falsely
  claiming project-level support that `generate --global` never produces.
- **`install --sync` consent**: elevated-artifact consent is now persisted
  (`accepted_elevated`) and replayed, so a sync no longer silently strips
  previously-consented hooks / permissions / mcp while `installs.yaml` and
  `pack.yaml` still claim them.
- **`refresh` / `install --sync` branch pins**: a branch pin (`@main`) keeps
  tracking the branch across refreshes instead of freezing to a SHA after the
  first refresh and never advancing again.
