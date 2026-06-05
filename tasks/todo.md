# Lessons → JSON Graph Redesign

Goal: replace the YAML-index + per-topic-Markdown lessons store with a single normalized JSON graph, exposed through one `agentsmesh lessons` CLI primitive that any harness (Claude, Cursor, Codex, plain shell) calls. Cut recall token cost from a 456-line index + topic file reads down to a filtered query result. Make capture atomic so the ritual stops being skipped.

## Decisions locked in (from prior turn)

- **Dedup on `add`:** never silently auto-deprecate near-duplicates. `lessons validate` flags them so a human resolves the conflict.
- **Topic taxonomy:** the existing 12 topics stay canonical (referenced from CLAUDE.md). `add` rejects unknown topics unless `--new-topic` is passed.
- **Evidence:** use lesson IDs and commit SHAs. The `L<line>` journal pointer scheme is retired. Old `L<n>` evidence strings are preserved verbatim on import for traceability but new entries never produce them.
- **Journal:** becomes a rendered view (`lessons journal`) over the graph; not a source of truth. The current `journal.md` is imported, then frozen as `journal.legacy.md`.

## Non-goals (this iteration)

- No remote sync / multi-repo lesson sharing.
- No similarity scoring beyond exact-rule-text duplicate detection.
- No web UI; CLI + MCP tool only.
- No removal of the old `index.yaml` + `topics/*.md` files until one full release after the new system ships green in CI.

## Architecture

```
.agentsmesh/lessons/
  lessons.json            # canonical graph (new SoT)
  journal.legacy.md       # frozen snapshot of pre-migration journal.md
  index.yaml              # DEPRECATED, kept read-only for one release
  topics/*.md             # DEPRECATED, kept read-only for one release
```

### `lessons.json` schema (v1)

```jsonc
{
  "version": 1,
  "lessons":  { "<lesson-id>": { rule, rationale?, topics: [topicId], triggers: [triggerId], evidence: [string], status, supersededBy?, createdAt } },
  "topics":   { "<topic-id>":  { summary } },
  "triggers": { "<trigger-id>": { kind: "file_glob"|"command_pattern"|"keyword", pattern } }
}
```

- IDs are slugged kebab-case.
- Trigger nodes are deduplicated (same kind+pattern collapses to one ID), so multiple lessons can share triggers cheaply.
- File is deterministically sorted (lessons by `createdAt` then id; topics/triggers by id) so diffs are clean.

### CLI surface (`src/cli/commands/lessons.ts`)

| Subcommand | Purpose |
|---|---|
| `lessons query --file <p> --cmd <c> --keyword <k> [--format json\|md\|plain]` | Recall primitive. Returns only matched lesson rules. |
| `lessons add "<rule>" --topic <id> [--trigger-file <glob>]... [--trigger-cmd <regex>]... [--trigger-kw <txt>]... [--evidence <ref>]... [--rationale <text>]` | Capture primitive. Atomic upsert. Prints lesson ID. |
| `lessons topics` | List canonical topics + summaries. |
| `lessons show <topic>` | Render a topic's lessons as Markdown (read-only view, matches old topic-file shape). |
| `lessons deprecate <id> [--superseded-by <id>]` | Mark a lesson `deprecated`. |
| `lessons journal [--since <iso>]` | Render the historical journal from graph nodes (replaces hand-maintained `journal.md`). |
| `lessons validate` | Schema + dangling-ref + duplicate-rule-text + unknown-topic checks. Non-zero exit on failure. |
| `lessons import-md` | One-shot migrator: parse current `index.yaml` + `topics/*.md` + `journal.md` → emit `lessons.json` + `journal.legacy.md`. Idempotent. |

### Public API additions (`src/public/lessons.ts`)

New exports (old ones stay during deprecation window):

- `loadLessonsGraph(projectRoot): LessonsGraph`
- `queryLessons(graph, event: ToolEvent): Lesson[]`
- `addLesson(projectRoot, input: AddLessonInput): { id: string }`
- `renderTopicMarkdown(graph, topicId): string`
- `renderJournalMarkdown(graph, opts?): string`
- `validateLessonsGraph(graph): ValidationReport`
- `importLegacyLessons(projectRoot): MigrationReport`

### MCP server

`src/mcp/*` gets two thin tools mirroring CLI: `lessons_query` and `lessons_add`. Same arg shape as CLI flags. No new surface — they delegate to the public API.

### Ritual rewrite

Edit `.agentsmesh/rules/_root.md` lessons section:

```
Recall (BEFORE edit/command):
  Run: agentsmesh lessons query --file <path> --cmd <command>
  Apply the returned rules.

Capture (IMMEDIATELY after failure):
  Run: agentsmesh lessons add "<imperative rule>" --topic <id> \
       --trigger-file <glob> --evidence <commit-sha|lesson-id>
```

Then `agentsmesh generate` propagates to every target's CLAUDE.md/AGENTS.md/etc.

## Implementation phases

Each phase is an independent commit. TDD: failing tests land first within the phase.

- [ ] **Phase 1 — Graph schema + read path**
  - [ ] `src/lessons/graph-schema.ts`: zod schema for `lessons.json`, `LessonsGraph`/`Lesson`/`Topic`/`Trigger` types.
  - [ ] `src/lessons/graph-store.ts`: `loadLessonsGraph`, `saveLessonsGraph` (deterministic JSON, trailing newline, sorted keys).
  - [ ] `src/lessons/query.ts`: `queryLessons(graph, event)` — reuses `matchTriggers` semantics from `matcher.ts`.
  - [ ] Tests: `graph-schema.test.ts` (round-trip, reject malformed), `graph-store.test.ts` (deterministic write — exact byte-for-byte), `query.test.ts` (file-glob + command-regex + keyword + combined, dedup across topics).
  - Acceptance: schema rejects unknown fields; query returns lessons in stable order; bytes-on-disk are deterministic.

- [ ] **Phase 2 — Migrator (`import-md`)**
  - [ ] `src/lessons/import-legacy.ts`: parses `index.yaml`, walks each `topics/*.md`, extracts each `## Rules` bullet as a `Lesson`. Preserves existing `(Evidence: L<n>)` text inside the `evidence[]` array verbatim, prefixed `legacy:`.
  - [ ] Generates topic IDs from existing `topic:` keys, trigger IDs from a deterministic hash of `kind|pattern`.
  - [ ] Copies `journal.md` → `journal.legacy.md`; does not delete original yet.
  - [ ] Tests: fixture-based — `tests/fixtures/lessons/legacy-input/` mirrors the real current `.agentsmesh/lessons/` shape; assertion is exact-match against a committed `expected/lessons.json` snapshot. Run on real repo data as integration test (separate test reads live `.agentsmesh/lessons/` and asserts no parse errors + count parity).
  - Acceptance: migrator is idempotent (second run produces byte-identical output); every existing topic + every journal bullet becomes a node.

- [ ] **Phase 3 — Write path (`addLesson` + `validate`)**
  - [ ] `src/lessons/add.ts`: upsert lesson, dedup trigger nodes, append to existing topics, reject unknown topic unless `--new-topic`. Returns assigned ID.
  - [ ] `src/lessons/validate.ts`: schema check, dangling trigger/topic refs, duplicate `rule` text (case- and whitespace-normalized), unknown-topic survey (lessons whose topic is `legacy:*`).
  - [ ] Concurrency: writes go through `proper-lockfile` on `lessons.json` (already used elsewhere — check existing lock util before adding dep).
  - [ ] Tests: add-then-query round-trip, add-dup-rule emits a `validate` finding, add with unknown topic without `--new-topic` errors, concurrent-writers test (`Promise.all` two adds → no data loss).
  - Acceptance: graph remains valid after any successful `add`; `validate` exits non-zero on injected breakage.

- [ ] **Phase 4 — CLI command + MCP tools**
  - [ ] `src/cli/commands/lessons.ts`: commander subcommand tree wiring to public API. ≤200 lines; split per subcommand if needed.
  - [ ] Wire into `src/cli/program.ts` (or wherever commands register).
  - [ ] MCP: `mcp__agentsmesh__lessons_query` + `mcp__agentsmesh__lessons_add` — descriptors live next to existing MCP tools.
  - [ ] Tests: CLI snapshot tests for each subcommand using `runCli` helper; assert exact stdout, exact exit codes, exact files-on-disk diff.
  - Acceptance: every CLI flag has a test; help text exists for every subcommand.

- [ ] **Phase 5 — Ritual + docs propagation**
  - [ ] Update `.agentsmesh/rules/_root.md` with the new Recall/Capture ritual (replacing the file-globs+index walk).
  - [ ] Run `agentsmesh generate` → propagated `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, etc. update.
  - [ ] Update `README.md` lessons section + `website/src/content/docs/reference/lessons.mdx` (create if absent).
  - [ ] Add `agentsmesh lessons` to the CLI overview docs.
  - Acceptance: `pnpm typecheck` + `pnpm lint` + `pnpm test` all green; `agentsmesh check` clean.

- [ ] **Phase 6 — Migration runbook + release**
  - [ ] Add a changeset entry (minor — new public API + new CLI surface; the YAML/MD path still works).
  - [ ] `import-md` runs automatically once on first `lessons` invocation if `lessons.json` is missing AND `index.yaml` exists; prints a one-time migration notice.
  - [ ] Add deprecation notice to `loadLessonsIndex`/`readTriggeredLessons` (JSDoc `@deprecated`, runtime no-op warning gated on env flag).
  - Acceptance: a checkout that has only the legacy files works without manual `import-md`.

- [ ] **Phase 7 — Remove legacy (separate release, not blocking)**
  - [ ] Track in a follow-up issue. After one minor release with both stores live, delete `index.yaml`, `topics/*.md`, `journal.md`, and the legacy API exports. Not in scope for this PR.

## Verification

- TDD per phase: failing test → implementation → green.
- `pnpm typecheck && pnpm lint && pnpm test` per phase.
- `pnpm test:e2e` after Phase 4.
- Apply `post-feature-qa` skill before declaring Phase 5 done.
- Manual check: run `agentsmesh lessons query --file src/cli/commands/lessons.ts --cmd "pnpm test"` and confirm output is the expected ≤500-token slice.

## Open risks / watch items

- `proper-lockfile` may not exist as a dep — if not, check `src/utils/` for an existing lock helper before adding a new one (project rule: no target-name hardcoding, no duplicate helpers).
- Reference rewriter (`src/core/reference/`) may have hard assumptions about `topics/*.md` existing. Sweep for `lessons/topics` references before deleting.
- Determinism: JSON.stringify key order is engine-defined for non-string keys but stable for string keys in V8. Sort explicitly to be safe; do not rely on insertion order.
- Path normalization (CLAUDE.md rule): CLI output displaying file paths must `.replaceAll('\\', '/')`. Lessons graph stores patterns as authored — do not normalize them.
