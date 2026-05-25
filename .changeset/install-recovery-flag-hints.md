---
'agentsmesh': patch
---

fix(install): surface recovery flags in every "no installable resources" error and document the auto-detect → flag fallback chain

`agentsmesh install <source>` runs the classifier first and falls back to user-supplied flags (`--path`, `--as`, `--target`, `--all`) when auto-detection refuses a source or can't disambiguate it. Three error paths used to dead-end without naming those flags, leaving the user stuck:

- `No installable files found under <path> for manual install` — now also says: *Try a different `--path`, or omit `--as` to let agentsmesh auto-detect the layout.*
- `No installable native resources found under "<path>" for target "<id>"` (both call sites) — now also says: *Try `--path <dir>` without `--target` for auto-detection, or `--as <kind>` for a flat-collection override.*
- `No installable resources after skipping invalid files (N): …` — now also says: *Fix the frontmatter in the source files (most often: unquoted scalars with embedded colons or square brackets), or narrow `--path` to a subdirectory that excludes them.*

The `agentsmesh install --help` description now spells out the precedence — auto-classify first, then `--path` / `--as` / `--target` / `--all` to override — instead of just listing flags alphabetically.

Regression tests pin the flag names (not literal phrasing) so the contract stays visible even if future copy-edits rework the sentences.
