---
'agentsmesh': minor
---

Prettier CLI on a real terminal via `@clack/prompts`: `generate`, `install`, `uninstall`, `refresh`, `import`, and `convert` now show spinners, styled status lines, and boxed summaries. Output stays plain and parseable when piped, in CI, or with `--json`/`NO_COLOR` — no escape bytes leak into scripted or machine-read output.

`agentsmesh matrix` now renders a vertical (transposed) table — targets as rows, features as compact symbol columns with a legend and abbreviation key — so it fits a normal terminal instead of overflowing horizontally across ~30 columns.
