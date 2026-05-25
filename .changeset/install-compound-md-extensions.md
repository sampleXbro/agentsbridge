---
'agentsmesh': patch
---

fix(install): compound `.md` extensions (e.g. `.agent.md`) stay on the canonical reader

`hasNonMdEntityMapper` and friends in
`src/install/importers/target-native-commands.ts` previously asked
`ext !== '.md'` to decide whether a target's extension was
"non-Markdown". That treated Copilot's `.agent.md` (a Markdown
sub-extension Copilot uses to mark agent files) as non-Markdown and
routed those files through Copilot's importer mapper **in addition**
to the canonical reader. For any repo containing `foo.agent.md`, two
canonical agents were emitted: one slugged `foo.agent` (canonical
read) and one slugged `foo` (Copilot mapper). Surfaced during the
`VoltAgent/awesome-claude-code-subagents` compatibility sweep when
the same input started producing two extra agents per `.agent.md`
file.

Now uses `ext.toLowerCase().endsWith('.md')`, so any `.<sub>.md`
compound stays on the canonical reader and the seam only fires for
genuinely non-Markdown formats (`.toml`, `.mdc`, `.yaml`, `.json`).
Pinned by a regression test in
`tests/unit/install/importers/target-native-commands-plugin.test.ts`
("compound .md extensions ... stay on the canonical reader — no
double-counting"), plus the existing per-kind plugin tests for
`.yaml`-extension plugins still pass unchanged.

Also includes the dedup-key change from the same commit: entities are
now deduped by source-file basename slug (matches the canonical
parser's `basename(path, '.md')` convention). Required because
`CanonicalRule` doesn't carry a `name` field — the prior
`entity.name`-keyed `Map` would collapse every rule into a single
entry. Fixes a separate latent issue on rule installs.
