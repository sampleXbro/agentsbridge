# Changelog

## 0.28.0

### Minor Changes

- e148490: Deterministic pre-edit lesson recall via a `PreToolUse` hook.

  `agentsmesh init --lessons` now wires the recall hook under **both** `PreToolUse` and `PostToolUse`, and `agentsmesh lessons hook` is event-aware (it echoes the harness `hook_event_name`). On targets whose hooks can inject context before a tool call (e.g. Claude Code), matching lessons are now surfaced **before the first edit/command** — guarding the "first touch" the previous PostToolUse-only design left unguarded — with no extra model turn and no compliance dependence. Session dedup keeps each lesson injected at most once per session, and `PostToolUse` remains as the fallback for harnesses that support only post-call context injection. Existing projects pick this up by re-running `agentsmesh init --lessons` (idempotent) and `agentsmesh generate`; behavior is unchanged when no `hook_event_name` is supplied (defaults to `PostToolUse`).

## 0.27.0

### Minor Changes

- c172153: Declare Amazon Q `additionalRules` as **Native** for project scope. AgentsMesh already emits each non-root rule as a separate `.amazonq/rules/<slug>.md` file (which Amazon Q auto-loads) and imports them back, so the capability was under-declared as `none`. Global scope stays `none` because Amazon Q has no global rules directory on disk (`~/.aws/amazonq/` is used only for MCP and agents).
- 9492875: Declare Augment Code `permissions` as **Native** for global scope (was `none`). Auggie (Augment's CLI) reads tool permissions from the personal `~/.augment/settings.json` `toolPermissions` array (`[{ toolName, permission: { type: allow | deny | ask-user } }]`), mapped to canonical allow / deny / ask. Generation now emits `toolPermissions` into the global settings.json (alongside `mcpServers`/`hooks`) and import reads it back. Project scope stays `none` — per Augment's docs, tool permissions are personal/global and apply only in the CLI, not the IDE extension. (Advanced `webhook-policy` / `script-policy` / `shellInputRegex` entries have no canonical equivalent and are skipped on import.)
- c172153: Codex CLI hooks are now declared **Native** (project and global), correcting a `partial` mislabel. Codex CLI reads lifecycle hooks from a real on-disk file — `.codex/hooks.json` (project) and `~/.codex/hooks.json` (global) — which AgentsMesh already generates from `.agentsmesh/hooks.yaml` and imports back, so the round-trip was fully working and only the declared capability level was wrong. The support matrix (README + website) now shows Codex CLI hooks as Native.
- 4d31ea5: Declare Continue `permissions` as **Native** for global scope (was `none`). Continue reads personal tool permissions from `~/.continue/permissions.yaml` (top-level `allow` / `ask` / `exclude` arrays of tool-matcher patterns); AgentsMesh now generates that file in global mode and imports it back, mapping `exclude` ↔ canonical `deny`. Project scope stays `none` — Continue's own spec marks project-level permissions "not implemented yet".

  Also: the descriptor schema now accepts a target's `globalSupport.scopeExtras` as a valid implementation of a settings-backed capability (mcp/hooks/ignore/permissions) at global scope, since `scopeExtras` is the global-only emit path Continue uses.

- eddf184: Declare GitHub Copilot `hooks` as **Native** for project scope (was `partial`). Copilot CLI auto-loads `.github/hooks/*.json` at startup, and AgentsMesh already generates `.github/hooks/agentsmesh.json` (plus wrapper scripts) and imports it back — the round-trip was fully working and only the declared level was wrong. Lint still warns about unsupported hook events and the POSIX-shell wrapper-script requirement. (Global Copilot hooks at `~/.copilot/hooks/*.json` remain a separate follow-up.)
- b591409: Declare Cursor `additionalRules` as **Native** (both scopes; was `embedded`). AgentsMesh already emits each non-root rule as a separate native `.cursor/rules/<slug>.mdc` file and imports them back — identical to Cline — so the level was under-declared. No generator/importer changes; the round-trip already worked.
- dcbe440: Declare Factory Droid `commands` as **Native** (both scopes; was `none`). Factory Droid reads custom slash commands from `.factory/commands/*.md` (project) and `~/.factory/commands/*.md` (global) — Markdown with optional `description` / `allowed-tools` frontmatter, filename as the command slug (per docs.factory.ai). AgentsMesh now generates and imports these native command files instead of projecting commands into `.factory/skills/am-command-*/SKILL.md`; `supportsConversion.commands` is removed. Regenerating replaces the old projected command-skills with native `.factory/commands/` files.
- b591409: Declare Gemini CLI `permissions` as **Native** for global scope (was `none`). Gemini's policy engine loads User-tier `~/.gemini/policies/*.toml`, and AgentsMesh's permissions generator/importer already produce and read that TOML — the global layout was simply suppressing it. Policies now emit in global mode and round-trip. Project scope stays `partial` (workspace-tier policies are disabled upstream).
- fd7e4a5: Declare Goose `hooks` as **Native** for both scopes (was `none`). Goose supports lifecycle hooks via the Open Plugin Specification — a `hooks/hooks.json` inside a plugin dir, auto-discovered at `.agents/plugins/agentsmesh/hooks/hooks.json` (project) and `~/.agents/plugins/agentsmesh/hooks/hooks.json` (global). The file uses the same wrapped command-hook shape as Codex CLI / Factory Droid (`{ "hooks": { "<Event>": [{ matcher?, hooks: [{ type, command }] }] } }`), so AgentsMesh now generates and imports it through the shared `wrapped-command-hooks` helper. The previous no-op `lintHooks` warning is removed.
- c94d3cd: Declare Goose `permissions` as **Native** for global scope (was `none`). Goose reads tool permissions from `~/.config/goose/permission.yaml` — a map keyed by category where AgentsMesh owns the `user` block (`always_allow` / `ask_before` / `never_allow`, mapped to canonical allow / ask / deny). Generation emits it via `scopeExtras` and **merge-preserves** every other category (notably Goose's runtime `smart_approve` cache); import reads the `user` block back. Project scope stays `none` (Goose has no project-level permission file), and the project-scope lint warning now points users at the global file instead of claiming permissions are unsupported.
- d34681a: Declare Pi Agent `commands` as **Native** (both scopes; was `none`). Pi discovers prompt templates from `.pi/prompts/*.md` (project) and `~/.pi/agent/prompts/*.md` (global) — Markdown with optional `description` frontmatter, filename as the command name, `$ARGUMENTS` substitution (per earendil-works/pi). AgentsMesh now generates and imports these native prompt templates instead of projecting commands into `.pi/skills/am-command-*/SKILL.md`; `supportsConversion.commands` is removed (agents are still projected as skills). Also corrects `metadata.officialUrl` to `https://github.com/earendil-works/pi` (was the non-existent `pi-labs/pi-agent`). Canonical `allowedTools` have no Pi equivalent and are dropped on generate.
- 0063ecc: Declare Roo Code `agents` as **Native** for project scope (was `partial`) by adding the missing importer. AgentsMesh already generated `.roomodes` (canonical agents → Roo `customModes`); it now imports `.roomodes` back into `.agentsmesh/agents/<slug>.md`, completing the round-trip (`slug` → filename, `name`/`description` → frontmatter, `roleDefinition` → body). Global agents stay `partial` because Roo's global custom modes live in VS Code globalStorage, not an AgentsMesh-ownable file.

### Patch Changes

- ed90714: Make Aider actually load the generated `CONVENTIONS.md`. Aider has no auto-discovery for `CONVENTIONS.md` — it must be referenced from `.aider.conf.yml` via the `read:` key — so the rules AgentsMesh emitted were silently ignored. Generation now also emits a project-level `.aider.conf.yml` with `read: [CONVENTIONS.md]`, merge-preserving any existing user config (other keys kept, `read` list unioned). Scoped to project mode (a home-level config's `read:` path semantics differ and are out of scope); the `.aider.conf.yml` is deterministic wiring and is not imported as canonical content.
- c172153: Fix Amazon Q agent generation/import using the wrong system-prompt key. AgentsMesh wrote and read `systemPrompt`, but Amazon Q's `agent-v1.json` schema uses `prompt` — so generated `.amazonq/cli-agents/*.json` agents silently lost their system prompt. Generation now emits `prompt`; import reads `prompt` and falls back to the legacy `systemPrompt` key so previously generated agent files still round-trip.
- c172153: Fix Augment Code rule frontmatter to use the official `type` key. AgentsMesh emitted boolean flags (`always_apply: true`, `agent_requested: true`), but Augment Code rules declare their activation via a single `type` field (`type: always_apply` / `type: agent_requested`). Generation now emits `type: …`; import reads `type` and still accepts the legacy boolean keys for backward compatibility.
- b591409: Fix `agentsmesh import --from crush --global` silently importing no MCP servers (and no hooks). The Crush config reader was scope-blind and always read `<root>/crush.json`; in global scope it now reads `~/.config/crush/crush.json` (Crush's real global config), so global MCP/hooks round-trip as the `native` matrix already claims.
- c172153: Fix Cursor hooks being emitted in a format Cursor cannot read. AgentsMesh wrote `.cursor/hooks.json` with Claude-style PascalCase event names (`PreToolUse`) and a nested `{ matcher, hooks: [...] }` structure, but Cursor uses camelCase event names (`preToolUse`, `postToolUse`, `beforeSubmitPrompt`, …) and a flat array of hook objects — so generated hooks silently never fired. Generation and import now use Cursor's real event names and flat shape, the canonical↔Cursor mapping round-trips, and a lint warning is emitted for canonical hook events Cursor has no equivalent for.
- b2ccc64: Fix `agentsmesh import --from factory-droid` silently dropping native droid agents. Factory Droid's `agents` capability was declared **Native** and generation already emitted `.factory/droids/<name>.md`, but the importer had no `agents` spec — so the round-trip the matrix promised never happened (import produced no `.agentsmesh/agents/*`). The descriptor now imports `.factory/droids/` (and the global `~/.factory/droids/`) back into canonical agents via the `agent` preset, completing the round-trip in both scopes.
- efd0c6f: Fix Factory Droid `hooks.json` format and complete its round-trip. Factory's `hooks.json` nests events under a top-level `"hooks"` key (`{ "hooks": { "PreToolUse": [{ matcher, hooks: [{ type, command }] }] } }`, per docs.factory.ai) — but generation emitted the bare top-level Claude Code shape Factory does not read, and there was no importer at all, so the declared **Native** hooks never round-tripped. Generation now wraps under `hooks` and `agentsmesh import --from factory-droid` reads it back into `.agentsmesh/hooks.yaml` (both scopes). The wrapped command-hook serialize/import logic — identical to Codex CLI's — is now a shared `wrapped-command-hooks` helper that both targets use, removing the duplication.

## 0.26.0

### Minor Changes

- 32c21ef: Prettier CLI on a real terminal via `@clack/prompts`: `generate`, `install`, `uninstall`, `refresh`, `import`, and `convert` now show spinners, styled status lines, and boxed summaries. Output stays plain and parseable when piped, in CI, or with `--json`/`NO_COLOR` — no escape bytes leak into scripted or machine-read output.

  `agentsmesh matrix` now renders a vertical (transposed) table — targets as rows, features as compact symbol columns with a legend and abbreviation key — so it fits a normal terminal instead of overflowing horizontally across ~30 columns.

- 51cb54f: Add an interactive `init` wizard. On an interactive TTY, `agentsmesh init` now asks which targets to generate for (none pre-selected — you pick at least one), whether to import any detected tool configs, optionally whether to enable Lessons, and whether to run `generate` immediately — writing a tailored `agentsmesh.yaml`. Every step after the first offers a **↩ Back** choice to revisit and change an earlier answer.

  The wizard runs in both project and `--global` scope. In `--global` it restricts the target list to global-capable tools and skips the Lessons step entirely (lessons is project-only, enforced at the writer).

  Fully backward compatible: the wizard is skipped and the original non-interactive behavior runs whenever `--yes`, `--json`, or a non-TTY/CI environment is detected. Scripted and CI usage is unchanged. Cancelling (Ctrl-C) at any prompt writes nothing.

### Patch Changes

- 28d8138: Fixed: the MCP server's `generate` tool now persists `.agentsmesh/.lock`. It previously reimplemented file-writing and skipped the lockfile (while still reporting `lockfileUpdated: true`), which left `agentsmesh check` permanently drifted in CI for projects that generate through the MCP server. The handler now delegates to the same path as `agentsmesh generate`, so it writes target files, cleans stale outputs, and updates the lock identically.
- c6cdeab: Rewrote `README.md` for a faster first read: a 60-second quickstart, a clearer before/after, and a tightened feature overview that now documents the interactive `init` wizard and automatic link rebasing — while still covering every feature and preserving the generated support-matrix tables. Added a "Minimal config" example to the `agentsmesh.yaml` reference page so new projects see the start-here config before the full reference.

## 0.25.0

### Minor Changes

- d2d175b: Security hardening and silent-data-loss fixes across the install, import, and generate pipelines, plus a tightened lessons skill.

  **Security**
  - The `install` / `extends` git fetch now enforces a transport allowlist (`https`/`ssh` only) on **both** the ref-resolution (`git ls-remote`) and the actual clone, before any git process is spawned — closing an SSRF / local-repo-probe primitive and a clone-time redirect-to-`ext::`/`file://` (RCE/local-read) vector. `git+http://`, `git+file://`, and `git+git://` sources are refused by default; opt in with `AGENTSMESH_ALLOW_INSECURE_GIT=1` (http) or `AGENTSMESH_ALLOW_LOCAL_GIT=1` (file). Clones now also run with `core.symlinks=false`.
  - The canonical parsers (`rules`/`commands`/`agents`/`skills`) and **every** native-import directory reader no longer follow symlinks. This prevents a malicious pack or an imported tool config from exfiltrating host files (e.g. `~/.ssh/id_rsa`) into canonical content or a redistributed pack.

  **Fixed**
  - `agentsmesh import --from cline` and `--from continue` now preserve URL/HTTP/SSE MCP servers instead of dropping every remote server on a generate → re-import round-trip.
  - The shared Markdown link scanner no longer corrupts content when a link label contains `(` or a link carries a `"title"` — the rewrite span now covers only the path.
  - The MCP `update_hooks` tool normalizes the nested native hook form to the flat canonical shape instead of silently discarding it.
  - A single unparseable lessons trigger (from a merge or hand-edit) no longer permanently blocks all future `lessons add`/`merge` captures — the write barrier now blocks only on errors the current mutation introduces.
  - `parseRules` now errors on duplicate-slug rule files that previously vanished silently.

  **Changed (breaking)**
  - Git transports other than `https`/`ssh` are refused by default on `install`/`extends`; re-enable `http`/`file` with the env vars above.
  - `agentsmesh import --from <tool>` no longer follows symlinks in a tool's config directories — symlinked rule/command/agent/skill files and directories are skipped. Share content via real files, `extends:`, or packs instead.
  - Case-only canonical name collisions (e.g. `commands/Build.md` + `commands/build.md`) are now a hard error at parse and generate time instead of a silent last-write-wins on case-insensitive filesystems.

  **Docs**
  - `agentsmesh.local.yaml` docs now describe the real replace/append/merge behavior (the previous "narrowing-only" guarantee was never enforced).
  - The `lessons` skill is now an Iron-Law gate (binding recall/capture, gate function, rationalization table) with a short trigger-first description; fetch-hardening and git-transport env vars are documented.

## 0.24.0

### Minor Changes

- 352f4a0: feat: close 23 target capability gaps and make new MCP capabilities round-trip

  Audited every supported target and implemented native or partial support for
  capabilities the underlying tools already offer but agentsmesh did not expose:
  - **MCP**: Goose (global, `~/.config/goose/config.yaml` extensions) and Copilot
    (project, `.vscode/mcp.json`) now both generate **and import** MCP servers, so
    the new native MCP capabilities round-trip back to canonical.
  - **Agents**: Augment Code, Amazon Q, and Cline gain native agent definitions.
  - **Skills / Commands**: Zed emits shared native skills; Trae gains native
    commands (`.trae/commands/`).
  - **Permissions**: Junie (global allowlist) and Kilo Code (`kilo.jsonc`) gain
    native permissions; Warp, Roo Code, and Antigravity declare `partial` support
    with lint guidance pointing at their UI / settings.
  - **Hooks**: Factory Droid, Deep Agents CLI, Antigravity, Qwen Code, Amp, and
    Codex CLI gain native lifecycle hooks.
  - **Combined settings sidecars**: Qwen Code and Amp write hooks + permissions
    into their settings files; Rovo Dev writes hooks + permissions to its global
    `config.yml`; Amazon Q gains agents + hooks + permissions.

  The shared `mcpJson` import mode gains an optional, data-driven `mcpServersKey`
  (defaults to `mcpServers`) so VS Code-style files keyed on `servers` import
  correctly — with no target-name hardcoding in core. The support matrix in the
  README and docs site is updated to match.

## 0.23.0

### Minor Changes

- 6a2e415: feat(lessons)!: JSON graph store, universal CLI primitives, clean break from YAML+MD

  **BREAKING.** The lessons subsystem is now a single normalized JSON graph at
  `.agentsmesh/lessons/lessons.json`. The previous YAML-index + per-topic
  Markdown + journal store is removed entirely. The legacy public API is
  removed.

  **Why a clean break:** dragging a deprecation window along would leave two
  parallel surfaces (CLI + library) that have to stay in sync forever, and the
  old recall ritual (read 400+ line YAML index + matching topic Markdown files)
  encouraged agents to skip it. The new single-command primitives — `lessons
query` to recall, `lessons add` to capture — are hard to rationalize past and
  return only matched rules (~100–500 tokens) instead of the whole index.

  ## What's new

  **CLI** (`agentsmesh lessons …`):
  - `query --file <p> --cmd <c> [--keyword <k>] [--format plain|md|json]` —
    recall primitive. Returns only matched lesson rules; defaults to one rule
    per line.
  - `add "<rule>" --topic <id> --trigger-file <glob> [--trigger-cmd <regex>]
[--trigger-kw <text>] [--evidence <ref>] [--new-topic --topic-summary
"<text>"]` — capture primitive. Lock-serialized, atomic, idempotent on
    repeat.
  - `topics`, `show <topic>`, `deprecate <id> [--superseded-by <id>]`,
    `journal`, `validate`, `import-md`.

  **MCP tools.** `lessons_query` and `lessons_add` register with the embedded
  MCP server. Same surface as the CLI primitives.

  **Programmatic API** (`agentsmesh/lessons`):
  - `loadLessonsGraph` / `tryLoadLessonsGraph` / `saveLessonsGraph` /
    `serializeGraph` / `graphFilePath` — deterministic load/save.
  - `queryLessons(graph, { file, command, keyword })` — recall.
  - `addLesson(root, input, opts?)` — capture; throws `UnknownTopicError` when
    the topic is missing without `allowNewTopic`.
  - `validateLessonsGraph(graph)` →
    `{ ok, findings: [{ level, code, message, … }] }`. Codes: `SCHEMA_INVALID`,
    `DANGLING_TOPIC`, `DANGLING_TRIGGER`, `DANGLING_SUPERSEDER`,
    `DUPLICATE_RULE`, `SUPERSEDED_WITHOUT_TARGET`, `ACTIVE_WITH_SUPERSEDER`,
    `ORPHAN_TOPIC`, `ORPHAN_TRIGGER`.
  - `importLegacyLessons(root, { migratedAt })` — one-shot upgrade migrator.
  - `acquireLessonsLock(root)` — process lock; same primitive as
    `.generate.lock` / `.install.lock`.

  ## Upgrade path

  If you used the previous YAML+MD store, the first `agentsmesh lessons`
  invocation auto-migrates: parses `index.yaml` + `topics/*.md` + `journal.md`,
  writes `lessons.json`, and **deletes the legacy files** so the project lands
  in a clean state. The migrator preserves provenance — every imported lesson
  gets `evidence[0] = "legacy:.agentsmesh/lessons/topics/<topic>.md#rule-N"`
  plus any inlined `(Evidence L<n>)` references parsed verbatim as `legacy:L<n>`.

  Run `agentsmesh lessons import-md` explicitly if you prefer to migrate at a
  specific point in time, e.g. inside a release-prep script.

  ## Removed (breaking)
  - **Files removed.** `.agentsmesh/lessons/index.yaml`,
    `.agentsmesh/lessons/journal.md`, `.agentsmesh/lessons/topics/`, plus the
    separate distill tracker (`distill-ledger.yaml`, `distill-proposal.md`).
    All are recreated under the new single-file graph by the migrator.
  - **Public API removed.** `loadLessonsIndex`, `readTriggeredLessons`,
    `appendLessonToJournal`, `formatLessonBullet`, `parseIndex`,
    `LessonsIndexSchema`, `LessonsCluster`, `LessonsIndex`, `matchTriggers`,
    `ToolEvent`, `parseBullets`, `ParsedBullet`, `hashBullet`, `loadLedger`,
    `saveLedger`, `Ledger`, `scoreBullet`, `ScoredCluster`,
    `LESSONS_JOURNAL_TEMPLATE`, `LESSONS_INDEX_TEMPLATE`, `AppendLessonResult`,
    `LessonCaptureInput`, `TriggeredLesson`.
  - **package.json scripts removed.** `distill`, `distill:apply`. The distill
    flow is subsumed by direct `lessons add`.

  ## Compatibility
  - The CLI surface is **additive** for the `lessons` subcommand tree — no
    existing CLI command changes shape.
  - `agentsmesh init --lessons` still scaffolds the subsystem; it now writes
    an empty graph instead of empty YAML+MD shells.
  - The procedural rule in `_root.md` is regenerated by `agentsmesh generate`
    into every target's root file; agents call the same two shell commands in
    every harness.

  ## Constraints
  - The graph at `.agentsmesh/lessons/lessons.json` is the single source of
    truth — never edit it by hand; go through the CLI or `addLesson`.
  - Writers serialize through a process lock at
    `.agentsmesh/lessons/.lessons.lock` — concurrent captures cannot lose data.
  - Output is deterministic (alphabetical keys at every depth, trailing
    newline) so diffs stay clean.

- 60dbbd9: feat(lessons): public-readiness hardening — discoverable flags, safer capture/recall, clearer errors

  The lessons subsystem is polished for general use, closing the gaps a first-time
  external user would hit. No breaking changes to the documented happy path.

  **Added**
  - `agentsmesh lessons query` now documents `--session`, `--no-dedup`, and `--ids`
    in `--help` (they were parsed but invisible), and every `lessons` subcommand
    **rejects unknown flags** with the correct usage instead of silently ignoring
    them — a typoed `--trigger-flie` no longer drops a trigger from a capture.
  - Running a `lessons` command from a subdirectory of a project now **warns**
    (`query` finds no graph here; `add` flags that it is about to create a stray
    `.agentsmesh`) instead of silently returning empty or writing to the wrong place.
  - Running a `lessons` command in a project initialized **without** `--lessons` no
    longer dead-ends silently: reads hint to run `agentsmesh init --lessons`, and
    `lessons add` still captures but warns that recall isn't wired into your AI
    tools until you activate the subsystem.
  - A present-but-malformed `.agentsmesh/lessons/config.json` now surfaces a stderr
    warning rather than silently reverting to defaults.

  **Changed**
  - Capture rejects a rule longer than 2000 characters (`OVERSIZED_RULE`), and the
    recall hook truncates any over-long rule before injecting it into agent context,
    so a graph from a cloned third-party repo cannot flood the context with one
    giant rule. The lessons reference now documents this **trust model**.
  - `agentsmesh lessons hook` bounds the stdin payload it reads, so a runaway pipe
    cannot exhaust memory.
  - `lessons` errors now surface verbatim in `--json` output (e.g.
    `"Recall needs a predicate…"`) instead of a generic `Command 'lessons' failed`.
  - `agentsmesh init --lessons` only prints "the graph starts empty" when it
    actually created the graph on this run.

- 0091779: feat(lessons): two-tier delivery — trimmed always-on trigger + on-demand `lessons` skill

  The lessons recall/capture contract now ships in two tiers, using agentsmesh's
  native primitives (rules + skills) rather than a single oversized root paragraph:
  - **Tier 1 — always-on trigger.** `LESSONS_PROCEDURAL_RULE` is trimmed to the
    binding essentials (both commands, the BLOCKING framing, the recall scope
    including read-only, the broad capture scope, the graph path, the MCP
    fallback). It is still injected into `.agentsmesh/rules/_root.md` as a managed
    block, so it reaches every target through canonical rule generation.
  - **Tier 2 — on-demand manual.** `agentsmesh init --lessons` now also seeds
    `.agentsmesh/skills/lessons/SKILL.md`, a `lessons` skill carrying the full
    operating manual (complete command set, topic workflow, trigger-flag
    mechanics, the exhaustive rejected-excuse enumeration). It generates to every
    skill-capable target and can grow without bloating always-on context.
  - **Graceful degradation.** Targets without skills still receive the Tier-1
    trigger, so the binding contract stays universal.

  The skill is **create-if-missing** — once present it is your canonical,
  user-owned content and is never clobbered. Projects generated with the previous
  single-tier block upgrade to the trimmed block exactly once on the next
  `generate`/scaffold (legacy form retained for clean strip/upgrade).

### Patch Changes

- 3d59e52: fix: six correctness bugs surfaced by a full feature review
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

- 6a5fc7e: fix(install): retry the git-source cache finalize on Windows transient locks

  Fetching a git `extends:`/`install` source could intermittently fail on Windows
  with `EPERM: operation not permitted, rename '<cache>.tmp' -> '<cache>'`. The
  fetcher finalizes the cache by renaming the freshly-cloned staging directory
  into place; on Windows the just-exited `git clone` handle (or an antivirus /
  search-indexer scan) can still pin those files for a few milliseconds, so the
  rename is rejected. The finalize rename now retries on the transient codes
  Windows raises (`EPERM`/`EACCES`/`EBUSY`/`ENOTEMPTY`/`EEXIST`) with a short
  backoff, so the lock clears instead of surfacing a spurious "fetch failed".
  POSIX behavior is unchanged (a single rename).

## 0.22.0

### Minor Changes

- c2a13ad: Add `agentsmesh init --lessons` and a new `agentsmesh/lessons` public API for
  the lessons recall + capture subsystem.

  The subsystem keeps agents from repeating past mistakes via a procedural rule
  that lives in every target's root file: before any edit or command, scan
  `.agentsmesh/lessons/index.yaml` and read every matched
  `.agentsmesh/lessons/topics/<topic>.md`; after any failure, append to
  `.agentsmesh/lessons/journal.md`. The optional repo-local `pnpm distill` /
  `pnpm distill:apply` scripts can help maintain AgentsMesh's own topic routing,
  but the generated rule does not require package-manager-specific tooling.

  **Using it:**
  - **Fresh init:** `agentsmesh init --lessons` — creates the canonical scaffold
    AND the lessons subsystem in one command.
  - **Retroactive add (existing project):** the same `agentsmesh init --lessons`
    — when `agentsmesh.yaml` already exists, init only scaffolds the lessons
    artifacts and appends the procedural rule to `_root.md`. Idempotent.
  - After either flow, run `agentsmesh generate` to project the procedural rule
    to every target's root file.

  **Public API** (importable from `agentsmesh/lessons`):
  - `scaffoldLessons(projectRoot)` — idempotent scaffolder used internally by
    `init --lessons`; reusable from custom tooling.
  - `loadLessonsIndex(projectRoot)`, `readTriggeredLessons(projectRoot, event)`,
    `appendLessonToJournal(projectRoot, input)`, and `formatLessonBullet(input)` —
    one high-level, target-agnostic read/write layer for integrations that should
    not hand-roll filesystem access.
  - `lessonsPaths(projectRoot)`, `LESSONS_PROCEDURAL_RULE`,
    `LESSONS_JOURNAL_TEMPLATE`, `LESSONS_INDEX_TEMPLATE` — paths and templates.
  - `parseIndex`, `LessonsIndexSchema`, `matchTriggers`, `scoreBullet`,
    `loadLedger`, `saveLedger`, `hashBullet`, `parseBullets` — building blocks
    for downstream tooling (custom distillers, recall hooks, IDE plugins).

  **Universal across every target.** The subsystem uses plain markdown files
  read via standard file I/O — no `Skill` tool, no description-match, no
  per-target projection. Works in Claude Code, Codex CLI, Cline, Roo Code,
  Cursor, Gemini CLI, Aider, Goose, and every other supported harness.

  **Linter integration:** `agentsmesh lint` now validates the lessons subsystem
  when present — checks that `index.yaml` parses, topic files referenced in the
  index exist, and the journal file is well-formed.

  **Constraints:**
  - `--lessons` is project-mode only. Combining with `--global` errors out.
  - Removal: `rm -rf .agentsmesh/lessons/` and strip the `## Lessons` paragraph
    from `.agentsmesh/rules/_root.md`.

### Patch Changes

- c75a424: Surface marketplace sub-pack install failures instead of swallowing them silently, and route skill-pack sub-packs through the correct install path.
- c75a424: Fix qwen-code global-mode rule embedding. Rules were silently dropped when generating in global mode; they are now embedded inline using the same pattern as other global-mode targets.
- c75a424: Restructure the generation contract paragraph to lead with an explicit **NEVER edit generated files** prohibition naming the generated paths (`.claude/`, `.cursor/`, `AGENTS.md`, etc.), followed by **All changes MUST go through `.agentsmesh` first**. Agents were initially understanding the contract but forgetting it over multi-step conversations — front-loading the prohibition makes it stickier. All legacy contract body versions (v1-v10) remain detected for safe in-place upgrade.

## 0.21.0

### Minor Changes

- b1efca1: Harden install pipeline against third-party supply-chain attacks.
  - **Strip elevated artifacts from non-local sources by default.** `hooks.yaml`, `permissions.yaml`, and `mcp.json` are now removed from any pack installed from a `github:`, `gitlab:`, or `git+...` source unless you opt in. These three files control your agent's tool settings (shell hooks, granted permissions, MCP launch specs) and a malicious pack shipping any of them could otherwise execute arbitrary local commands the next time the matching event fires. Opt in per-artifact with `--accept-hooks`, `--accept-permissions`, `--accept-mcp`, or all three with `--accept-elevated`. Local sources remain trusted as before.
  - **Skill supporting-file traversal no longer follows symlinks.** A pack containing `skills/foo/keys -> /Users/victim/.ssh` previously pulled external bytes (private keys, etc.) into the canonical skill content. Skill traversal now uses the existing `readDirRecursiveNoSymlinks` helper, mirroring the hardening already applied to install-manifest hashing.
  - **Redact credentials from remote-fetch error output.** `oauth2:<token>@`, `x-access-token:<token>@`, and any other userinfo-bearing URLs are now masked (`https://***@host/...`) in console warnings and thrown error messages so GitHub PATs and GitLab tokens never leak into CI logs, terminal scrollback, or log shippers.
  - **Gate `git+file://` sources behind `AGENTSMESH_ALLOW_LOCAL_GIT=1`.** On shared/multi-tenant hosts a `git+file:///tmp/world-writable-repo` `extends:` clause could silently consume a repo planted by another user; combined with downstream elevated-artifact emission this was a local priv-esc vector. Set `AGENTSMESH_ALLOW_LOCAL_GIT=1` to enable for closed-network development.
  - **Allowlist tar entry types on GitHub tarball extraction.** Previously only `Link` and `SymbolicLink` were rejected (denylist). Now only `File` and `Directory` entries extract; FIFOs, devices, hardlinks, and any future/exotic tar variant are rejected by default.

  These changes apply to `agentsmesh install`, `agentsmesh refresh`, and any `extends:` resolution against a non-local source. They are behavior changes for users who were silently inheriting hooks/permissions/mcp from a remote pack — re-run with the matching `--accept-*` flag (or `--accept-elevated`) to preserve previous behavior intentionally.

## 0.20.0

### Minor Changes

- 6739c63: feat(refresh): add `agentsmesh refresh` to re-fetch and re-apply installed packs

  A new top-level CLI command and MCP tool for keeping installed packs in
  sync with their declared sources. Branch pins re-resolve to the current
  tip; tag pins re-resolve in case the tag moved; SHA pins stay put. Per-pack
  atomic via the existing `materializePack` swap — a failure or interruption
  leaves the affected pack at its pre-refresh state.

  ```
  agentsmesh refresh                          # refresh every installed pack
  agentsmesh refresh my-pack,other-pack       # refresh just these
  agentsmesh refresh --dry-run                # preview without writing
  agentsmesh refresh --force                  # skip the drift consent prompt
  agentsmesh refresh --json                   # JSON output (implies --force)
  agentsmesh refresh --global                 # global scope
  ```

  **MCP parity:** new `mcp__agentsmesh__refresh` tool with the same
  `{ names?, dry_run?, global? }` input shape MCP install/uninstall use.
  `force: true` is implicit (no TTY). Errors map to two new codes —
  `REFRESH_RESOLVE_FAILED` and `REFRESH_APPLY_FAILED` — plus the existing
  `LOCK_HELD` and `IO_ERROR`.

  **Drift handling:** modified pack files trigger a consolidated consent
  prompt with a 5-minute timeout (default no). `--force` bypasses the prompt
  and overwrites local edits. The prompt is collapsed across packs so a bulk
  refresh asks once, not N times.

  **Schema additions** (`installs.yaml`, all optional, backwards-compatible):
  - `original_ref?: string` — the user's original ref expression (e.g.
    `main`, `v1.2.3`) captured at install time. Used by refresh to
    re-resolve branch pins. Absent on installs predating this release;
    refresh becomes a deterministic no-op for those rows.
  - `refreshed_at?: string` — ISO-8601 timestamp of the last successful
    refresh. Surfaces in `installs list` under the "LAST TOUCHED" column
    (falls back to `installed_at` when absent).

  **Behavior changes that could affect existing consumers:**
  - `installs.yaml` rows written by this release include `original_ref`.
    Pre-existing rows continue to parse and behave identically.
  - `--json` on `agentsmesh refresh` implies `--force` (CI/MCP can't
    answer the consent prompt). Documented on the website CLI reference.
  - `installs list` column header was "INSTALLED AT", now "LAST TOUCHED",
    showing `refreshed_at` when present and `installed_at` otherwise.

  **Architecture notes:**
  - `installAsPack` gains an optional `forceFreshMaterialize` flag,
    threaded through five layers (`install-flags → run-install →
run-install-locked → single-pack-install → run-install-execute →
installAsPack`). Default is false; install's existing flow is
    untouched. Refresh sets the flag to bypass the
    merge-into-existing-pack branch and force atomic replacement via
    `materializePack`.
  - Source-URL parsing is now shared between install and refresh via the
    new pure `parseSourceUrl` helper (`src/install/source/parse-source-url.ts`).

  **Refresh does NOT switch refs.** To move a pack to a different ref,
  re-run `agentsmesh install <source>@<new-ref>` — install silently
  overwrites an existing pack of the same name.

  **Refresh vs `install --sync`** are orthogonal. `--sync` replays missing
  installs from `installs.yaml` (fresh clone). `refresh` updates existing
  installs against their declared sources.

  Verified end-to-end against 64 community packs from the install
  compatibility log spanning Anthropic skill-packs, marketplaces (`--all`),
  canonical mixed packs, flat collections, root SKILL.md, root CLAUDE.md,
  manual `--path`/`--as`/`--target` combinations, and packs using `pick`
  selectors. Full unit/integration/e2e suite green (7700+ tests).

## 0.19.1

### Patch Changes

- 041b9c5: fix(security): plug input/path/proto-pollution holes in plugin, install, MCP, and config

  Closes a batch of security audit findings (2 HIGH + 5 MEDIUM):
  - **Plugin source containment** (`src/plugins/load-plugin.ts`) — local plugin
    sources are now resolved with `realpath` and rejected when they escape
    `projectRoot`. A hostile `agentsmesh.yaml` with
    `plugins[].source: "../../tmp/evil.js"` no longer reaches dynamic
    `import()`. Bare npm specifiers continue to resolve through
    `node_modules/<source>`. Both sides are canonicalized so macOS
    `/tmp -> /private/tmp` (and other platform-level symlinks) do not
    produce false positives.
  - **Prototype pollution denylist** (`src/config/core/loader.ts`) —
    `deepMergeObjects` over `agentsmesh.local.yaml` now skips `__proto__`,
    `constructor`, and `prototype` keys. Defense-in-depth: the `yaml` v2
    parser already strips `__proto__`, but this pins the invariant against
    future parser swaps.
  - **Install manifest name validation** (`src/install/core/install-manifest.ts`) —
    `installManifestEntrySchema.name` now refuses path separators, NUL,
    and `.`/`..` segments. A poisoned `installs.yaml` entry can no longer
    drive `rm -rf` outside `.agentsmesh/packs/` at uninstall time.
  - **`git+http://` allowlist** (`src/config/remote/remote-source.ts`) —
    rejected by default; opt-in via `AGENTSMESH_ALLOW_INSECURE_GIT=1` for
    closed-network development. `https://`, `ssh://`, and `file://` are
    unchanged. Closes a MITM window before SHA pinning resolves.
  - **MCP `cwd` / `description` refinement** (`src/mcp/schemas.ts`) — `cwd`
    rejects `..` segments (POSIX + Windows separators), NUL, and newlines;
    `description` rejects NUL and newlines. MCP clients can no longer
    plant a structurally-escaping working directory that downstream agents
    consume via `spawn(command, args, { cwd })`.
  - **Global path redaction in MCP errors** (`src/mcp/errors.ts`) —
    `redactAbsolutePaths` now strips paths anywhere in the string, catching
    embedded paths in stack frames (`at Foo (/Users/...)`) and quoted
    paths in Node errors (`ENOENT, open '/Users/...'`) the prior
    whitespace-anchored regex missed.
  - **`copyDir` symlink hardening** (`src/utils/filesystem/fs-traverse.ts`) —
    `copyDir` now uses `lstat` and skips symlinks. A symlink in the source
    tree pointing outside its root can no longer have its target's bytes
    exfiltrated into the destination (and into any redistributed pack
    built on top of it).

  Behavioral changes that could affect existing consumers:
  - `git+http://...` extends/installs require `AGENTSMESH_ALLOW_INSECURE_GIT=1`.
  - MCP server entries with `cwd: "../foo"` no longer parse — rewrite as a
    POSIX-relative path without `..` segments.
  - Plugin `source:` entries pointing outside the project tree no longer
    load. The standard `node_modules/<plugin>` and project-local layouts
    are unaffected.
  - A poisoned `installs.yaml` entry whose `name` contains separators or
    `..` is now dropped at parse time (the rest of the manifest survives).
  - A `agentsmesh.local.yaml` payload at `__proto__`, `constructor`, or
    `prototype` keys is silently dropped instead of merged.

  Branch coverage > 95% on every touched file; full unit/integration suite
  (7596 tests) and plugin e2e suite (57 tests) green.

## 0.19.0

### Minor Changes

- 879eeed: refactor(install): every install-time command-directory read now delegates to per-target importer mappers

  The previous skill-pack-aggregator refactor wired the target-mapper
  delegation seam (`hasToolNativeCommandImporter` + `readToolNativeCommands`)
  into exactly one call site: `mergeCommands`. The canonical / manual /
  flat-collection install paths still routed through plain `parseCommands`
  (`.md`-only), so a root-level `commands/*.toml` (Gemini CLI's native
  format) on `JuliusBrussee/caveman` and similar repos was silently dropped
  with a "Skipped N commands file(s) ... format: .toml" warning, even though
  the gemini-cli descriptor already ships a TOML-aware mapper.

  This change generalizes the seam into a single shared helper
  (`readCommandsDirWithMappers`) used by every install-time read:
  - **`src/install/importers/target-native-commands.ts`** gains
    `readCommandsDirWithMappers(srcDir, { restrictToTarget?, parseOpts? })`.
    When `restrictToTarget` is set (per-tool dir like `.gemini/commands/`),
    only that target's mapper runs. When unset (canonical root `commands/`),
    every registered target's non-`.md` mapper is tried; canonical `.md`
    wins on basename collision so dedup-log readability is preserved.
  - **`src/canonical/load/load-canonical-slice.ts`** now returns
    `{ canonical, cleanup }` and takes an `enableTargetCommandMappers` flag.
    Install-path callers (`discoverFromContentRoot`) set it; the extends
    path leaves it off to preserve the historical `.md`-only behavior and
    avoid the tmpdir staging lifecycle (extends would need cross-load
    cleanup tracking that isn't worth the complexity for a rare edge case).
  - **`src/sources/anthropic-skill-pack/merge-commands.ts`** drops its
    bespoke per-spec loop and routes every spec — canonical root `commands/`
    and per-tool dirs alike — through the shared helper.
  - **`src/install/run/run-install-discovery.ts`** and
    **`src/install/manual/manual-install-discovery.ts`** merge the slice's
    staging cleanup into the existing `prep.cleanup` lifecycle.

  Result on `JuliusBrussee/caveman`: install with no flags previously
  produced `7 skills + 3 agents` and warned about 4 TOML commands; now
  installs `7 skills + 4 commands + 3 agents`, no warning, no flag needed.
  Verified end-to-end (`Installed 7 skills, 4 commands, 3 agents`).
  `addyosmani/agent-skills` (the original skill-pack test) remains at
  `23 skills, 8 commands, 3 agents` — no regression.

  Architectural payoff: adding a future target whose commands use a
  non-Markdown format is now a one-place change in that target's
  descriptor. The aggregator and every install path automatically pick up
  the new format via the shared seam.

- 3b6af70: feat(install): detect upstream SPDX license at pack-creation time and surface it in `agentsmesh installs list`

  Every `agentsmesh install <source>` now probes the materialized pack root for a `LICENSE` / `COPYING` / `NOTICE` / `COPYRIGHT` file (across `.md` / `.txt` / `.rst` / no-extension variants) and runs a conservative SPDX detector against the bytes. The detector recognizes the dozen most common OSI/SPDX licenses by their canonical text fingerprints (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, GPL-2.0, GPL-3.0, LGPL-2.1, LGPL-3.0, AGPL-3.0, MPL-2.0, ISC, CC0-1.0, Unlicense) plus the explicit `SPDX-License-Identifier:` header. Unknown text resolves to `null` — better to say "unknown" than mislabel exotic terms.

  The detected identifier is recorded in `pack.yaml#license`, propagated through `InstallsListEntry`, and rendered as a new `LICENSE` column in `agentsmesh installs list` (and JSON output). Lets you scan installed packs and spot proprietary or unknown-terms upstreams at a glance before relying on them.

  Pack metadata schema is additive (`license` is optional) and prior `pack.yaml` files keep parsing — no migration needed.

- 975bdb5: Skill-pack-aware install pipeline, new `uninstall` and `installs` commands, descriptor-driven target dispatch refactors, and a senior-architect hardening pass. Roll-up of every change on `develop` since `v0.18.1`.

  ## New commands

  ### `agentsmesh install <url>` (extended)

  Now auto-detects three source shapes via a multi-signal classifier (`src/install/classify/`) and dispatches accordingly:
  - **`anthropic-skill-pack`** — imports root `skills/`, `agents/`, `references/`, merged per-target `.claude/commands/` + `.gemini/commands/`, and multi-tool rule files as one bulk set. A single command imports the full pack (e.g. all 23 skills + 3 agents + 7 commands of `addyosmani/agent-skills`); pre-change behaviour required 7+ invocations with `--as`.
  - **`canonical-agentsmesh`** — unchanged.
  - **`tool-native`** — unchanged. Five backcompat fixtures (`tests/integration/install-backcompat.integration.test.ts`) pin the discriminator threshold so legacy repos take their original path.
  - **`unknown`** — unchanged canonical-slice fallback.

  The discriminator threshold (sum of matched signal weights ≥ 1.4 with the primary `skills/<kebab>/SKILL.md` signal present) makes false positives essentially impossible on tool-native or canonical repos. `--target` and `--as` keep their explicit-override semantics and skip the classifier.

  When classified as a skill pack and a TTY is attached, two interactive prompts surface:
  - **Bulk select (three tiers)** — `[a]ll / [n]one / [s]elect per type` summary banner → per-type `[y/n/c]` → per-entity `[y/N/a=accept-all-remaining/q=skip-all-remaining]`. `--force`, `--json`, and non-TTY contexts accept everything.
  - **Broken-link (three options)** — for body links that point outside the imported subtree, classify each as in-tree-included / resolvable-outside / unresolvable and cluster per entity. `[i]nclude resolvable as supporting files / [l]eave with warnings / [a]bort install`. `--force` defaults to `[l]eave-with-warnings`.

  New flags:
  - `--all` — install every sub-pack from a `.claude-plugin/marketplace.json` source.

  Other install improvements:
  - **Source-layout detection covers community-repo shapes**: root-level `SKILL.md` (`blader/humanizer`), root `.cursorrules` / `.windsurfrules` (`PatrickJS/awesome-cursorrules` style), nested marketplace plugin trees (`.claude-plugin/marketplace.json`), and arbitrary 2+ sub-pack directory layouts. The picker is descriptor-driven via `selectInstallCandidates`.
  - **Concurrent-install lock** — `.agentsmesh/.install.lock` is acquired at the top of any `install` or `uninstall` run (and held across `--sync` replay). Concurrent invocations on the same project fail fast with `LockAcquisitionError` rather than racing on filesystem writes.
  - **Pack writes are atomic** via staging-dir + rename. Each install now writes `.agentsmesh-install-manifest.json` next to the pack with the install-time `name`, `source`, `installed_at`, classifier verdict (`source_type`), and per-file `sha256:` map.
  - **Pack-name preservation across URL variants** — `findExistingInstallName` (`src/install/core/install-name.ts`) keys reuse on canonical `github:<org>/<repo>` plus identity scope (`target + as + features`), so `https://`, `git@`, and `github:` spellings of the same source dedupe into one pack. The `git+` prefix is now stripped iteratively (no recursion, safe under malicious manifest input).
  - **Lenient frontmatter parsing for all third-party imports** — `readSkillFrontmatterName` and `inferMdcTarget` skip files with invalid YAML and continue, rather than aborting the whole install on one bad scalar.
  - **Flat-collection basename collisions** — when two `--as <kind>` flat-collection files share a basename, names are namespaced rather than dropped silently.
  - **`--path`, `--target`, `--as` flags** — all trimmed symmetrically; empty/whitespace-only values now correctly normalise to "not provided" inside recursive auto-pick calls.

  ### `agentsmesh uninstall <name>[,<name>...]` (NEW)

  Removes one or more installed packs:
  - `rm -rf .agentsmesh/packs/<name>/`.
  - Drops the row from `installs.yaml`.
  - Drops the matching `extends:` row from `agentsmesh.yaml` when present (`install --extends` is now uninstallable).
  - Runs `generate` so `cleanupStaleGeneratedOutputs` evicts orphaned target files.

  Flags: `--all`, `--keep-pack` (leave pack on disk; only drop yaml entries), `--keep-generated` (skip the final generate; warn about stale targets), `--global`, `--dry-run`, `--force`, `--json`. The `--keep-pack` flag also doubles as the apply-layer equivalent of the interactive `[k]eep-modified` action. `--force` is implied by `--json`.

  Pre-uninstall **drift check** compares the current pack contents against `.agentsmesh-install-manifest.json`. When drift is detected, a modified-files prompt offers `[d]elete-anyway / [k]eep-modified / [a]bort`; `--force` defaults to `[d]`. Legacy packs (no manifest) auto-migrate at uninstall time — current contents become the baseline; a warning makes this explicit. Exit `130` on user-aborted prompt; `0` on success or `--dry-run`.

  **Mid-batch failure isolation** — if `applyUninstall` throws for one pack, survivors continue. The failure lands in a new `data.failed[]` envelope; post-operation `generate` still runs over the packs that succeeded so the tool tree stays consistent with the (possibly partially mutated) `installs.yaml`. Exit code is `1` when any pack failed.

  **`--dry-run uninstall` is a true no-op** — the legacy-manifest migration computes the baseline in memory but does NOT persist `.agentsmesh-install-manifest.json` to disk under `--dry-run`.

  ### `agentsmesh installs list` (NEW)

  Read-only inventory. Reads `installs.yaml`, hydrates `installed_at` + `source_type` from each pack's manifest, and emits either a space-padded `NAME / SOURCE / FEATURES / INSTALLED` table or a JSON envelope. Empty list exits 0. Forward-slash `pack_path`. `--global` reads from `~/.agentsmesh/installs.yaml`. The plural-vs-singular typo (`installs` vs `install`) surfaces a "did you mean `install`?" hint on unknown subcommands. Help banner comes from the central `help-data.ts` (single source of truth).

  ## Reliability fixes (broken-link rewriter)

  Two silent data-corruption bugs in the skill-pack broken-link `[i]nclude` flow are now fixed:
  - **Verbatim destination matching** — body rewrites match `ScannedLink.raw` (the as-authored text), not a normalized form. Bodies authored with `{baseDir}/foo.md` or Windows-style `..\refs\x.md` previously copied the supporting file but silently skipped the body rewrite, leaving an orphan `references/<basename>` plus a still-broken link. Both forms now rewrite correctly.
  - **Basename-collision disambiguation** — two distinct outside paths sharing a basename (`docs/A/README.md` + `docs/B/README.md` → `references/README.md`) previously dropped the second file's bytes and pointed both citations at the same target. Names are now slugged from the full `resolvedRelative` on collision (`references/docs-A-README.md`, `references/docs-B-README.md`).

  ## Drift-detection robustness
  - **CRLF / BOM normalization** — `hashFileForManifest` (`src/utils/crypto/hash.ts`) normalizes `\r\n?` → `\n` and strips a leading UTF-8 BOM for text-extension files (`.md`, `.json`, `.yaml`, etc.) before hashing. A Windows editor saving CRLF or a tool prepending a BOM no longer registers as drift. Binary files are still hashed as raw bytes.
  - **Symlink-safe traversal** — install-time pack hashing and uninstall-time drift detection now use `readDirRecursiveNoSymlinks`. A symlink that used to be followed at install (silently absorbing external bytes into the hash) only to be unlinked-without-following at uninstall (`rm` removes the link, not the target) no longer produces a permanent drift-detection mismatch.

  ## IDE auto-config via in-file schema directives (NEW)

  Every YAML / JSON file the CLI writes is now stamped with an editor-recognizable schema directive so VSCode (Red Hat YAML extension), JetBrains IDEs, vim/neovim with `yaml-language-server` / `coc-json`, and the GitHub Actions YAML editor get autocomplete + validation immediately — **no IDE configuration required**.

  YAML files get a top-of-file comment:

  ```yaml
  # yaml-language-server: $schema=https://unpkg.com/agentsmesh@<version>/schemas/<name>.json
  version: 1
  ...
  ```

  JSON files get a top-level `$schema` field. URLs are pinned to the running package version so the schema referenced always matches the format the file was written with; older files keep working pointed at their original schema until a writer touches them again.

  Stamped files:
  - `init` writes — `agentsmesh.yaml`, `agentsmesh.local.yaml`, `.agentsmesh/hooks.yaml`, `.agentsmesh/permissions.yaml`.
  - `install` writes — `.agentsmesh/installs.yaml`, `.agentsmesh/packs/<name>/pack.yaml`, `.agentsmesh/packs/<name>/.agentsmesh-install-manifest.json`.
  - `uninstall` refreshes — `.agentsmesh/installs.yaml` after row removal.

  Implementation: a single helper module `src/utils/output/schema-directive.ts` exports `prependYamlSchemaDirective`, `stampJsonSchemaField`, `schemaUrl`, and `yamlSchemaDirective`. Each is idempotent — re-running a writer on a file that already carries the directive updates the URL in place rather than duplicating the line. New reference page at `reference/json-schemas.mdx` documents all four IDE mechanisms (in-file directive, `$schema` field, VSCode workspace settings, SchemaStore.org plans), CI validation examples, and troubleshooting. The getting-started installation guide expands the existing IDE-autocomplete section to mention the new `installs` and `install-manifest` schemas.

  ## Published JSON Schemas — required-field correctness (FIX)

  A long-standing bug in the published `schemas/*.json` files marked every field with a `.default(...)` in its Zod source as `required: true`. Editors then complained about valid minimal configs (e.g. an `agentsmesh.yaml` with just `version: 1` was flagged as "Missing required properties: overrides, pluginTargets, plugins"). The runtime parser substituted the documented default in every one of these cases — only the published schema disagreed.

  Fixed by a post-processor in `src/schemas/schema-generator.ts::stripRequiredFromDefaults` that walks the emitted JSON Schema and strips defaultable fields from every `required` array. The Zod source schemas keep plain `.default(...)` (so the parsed TS type stays `T`, never `T | undefined`); the publishing layer alone reconciles "default present" with "user MUST provide". `buildAllSchemas()` calls the post-processor for all seven schemas. New regression test asserts the top-level `agentsmesh.json` required list collapses to `['version']`. Verified: `pnpm schemas:generate` produces correct `required` arrays:
  - `agentsmesh.json`, `installs.json` — only `version`
  - `permissions.json`, `hooks.json`, `mcp.json` — no required (everything has a default)
  - `pack.json`, `install-manifest.json` — required = the documented structural fields, unchanged

  ## Published JSON Schemas (NEW)

  Two new entries in the published `schemas/` directory (already shipped via `package.json`'s `files` array) cover the two new file formats introduced in this release:

  | File                            | Documents                                                                                                                                                                                           |
  | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `schemas/installs.json`         | `.agentsmesh/installs.yaml` — the install manifest that records every materialized pack so `--sync` can replay them post-clone.                                                                     |
  | `schemas/install-manifest.json` | `.agentsmesh/packs/<name>/.agentsmesh-install-manifest.json` — per-pack integrity manifest (install-time provenance + per-file `sha256:` map used by `uninstall` to detect locally-modified files). |

  Both schemas are generated from their respective Zod sources (`installManifestSchema` in `src/install/core/install-manifest.ts`; `installManifestFileSchema` in `src/install/manifest/install-manifest-hash.ts`) and verified by the existing schema-freshness test, which now covers all seven published schemas (was five).

  Editors / GitHub schema validators that wire `$schema: https://unpkg.com/agentsmesh/schemas/installs.json` (or the corresponding install-manifest URL) get autocomplete and validation for these files; CI tools can use them to assert pack provenance without hand-coded JSON-shape checks. `buildAllSchemas()` and the `pnpm schemas:generate` script now produce **7 JSON schemas** instead of 5.

  ## MCP server — pack lifecycle tools (NEW)

  The built-in `agentsmesh mcp` server now exposes three additional tools so AI agents speaking MCP can install, uninstall, and inspect community packs without leaving the conversation:

  | Tool            | Purpose                                                                                                                         |
  | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | `install`       | Install a community pack from a URL or local path. Auto-classifies the source layout; `target` / `as` overrides the classifier. |
  | `uninstall`     | Remove one or more installed packs. Mid-batch failures isolated; survivors continue.                                            |
  | `installs_list` | Read-only inventory of installed packs (also exposed as `agentsmesh://installs` resource).                                      |

  All three run with `force: true` internally — MCP has no stdin TTY, so the documented `--force` defaults are accepted for every interactive prompt the CLI would surface (bulk select → accept all, broken-link → leave-with-warnings, modified-files → delete-anyway). Input shapes mirror the CLI flags one-for-one; output envelopes match `InstallData` / `UninstallData` / `InstallsListData`.

  Tool count moves from **41 → 44**; resource count moves from **16 → 17**. The MCP docs reference and the in-tree `register` / `tool-tables-sweep` contract tests are updated to match.

  ## Programmatic / JSON-envelope additions (additive)

  New required fields on public types. JSON readers are unaffected (additive); TypeScript code constructing these types directly needs to populate the new fields:

  | Type                    | New field                         |
  | ----------------------- | --------------------------------- |
  | `UninstallData`         | `failed: Array<{ name; reason }>` |
  | `UninstallRemovedEntry` | `partial: boolean`                |
  | `AppliedRemoval`        | `partial: boolean`                |

  `partial` lets JSON consumers distinguish a fully-clean removal from one where bytes were kept by design (`--keep-pack`, `[k]eep-modified`) or where a step silently no-op'd (no matching extends row, missing pack dir, etc.).

  ## Descriptor-driven target dispatch (internal refactor)

  Several install-layer behaviours that previously branched on hardcoded target IDs in shared code now read directly from the relevant target descriptor:
  - **Native-format detection** — `src/config/resolve/native-format-detector.ts` walks `descriptor.detectionPaths` instead of a hand-maintained per-target table.
  - **Native importer dispatch** — `src/install/native/native-importers.ts` looks up the importer via the descriptor registry.
  - **Command directories** and **starter exclusions** — derived from each descriptor's `managedOutputs.dirs` and `excludeFromStarterInit` flag.
  - **Conversion defaults** — `commands_to_skills` / `agents_to_skills` defaults now live on each descriptor's `conversionDefaults`, removing duplicated per-target enable lists.
  - **Path-to-target hint map** — built at module load from descriptor `managedOutputs.dirs` patterns matching `^\.[^/]+\/(rules|commands|agents|skills)$`.

  Plugin descriptors transparently inherit all of these capabilities.

  ## Schema tightening (BREAKING for plugin authors)

  **`validateDescriptor()` now requires `metadata`:**

  ```ts
  metadata: {
    displayName: string;
    category: 'cli' | 'ide' | 'agent-platform';
    officialUrl: string;
    shortDescription: string;
  }
  ```

  Plugins built against earlier versions will fail to register at runtime until the descriptor adds the `metadata` block. All bundled plugin fixtures + the 30 built-in target descriptors already include it.

  The Zod schema also now models `emitScopedSettings`, `mergeGeneratedOutputContent`, `postProcessHookOutputs`, and `preservesManualActivation` (previously laundered away by a `passthrough()` + cast).

  ## Operational polish
  - **`AGENTSMESH_MAX_TARBALL_MB`** env var caps GitHub tarball acceptance (default 500, range 1-4096). Set higher for large monorepo installs.
  - **`AGENTSMESH_STRICT_PLUGINS=1`** turns plugin descriptor import failures from warning-and-skip into hard errors (CI gate).
  - **Best-effort post-install / uninstall generate** — when the post-operation `generate` pass fails (e.g. lock contention), the surrounding `install` / `uninstall` exits cleanly with a warning rather than reverting the install/uninstall work.
  - **First-time install on a fresh project** — `acquireInstallLock` now `mkdir`s the canonical dir before writing the lockfile, eliminating an ENOENT failure when no `.agentsmesh/` exists yet.
  - **`agentsmesh install --json` and `agentsmesh uninstall --json`** — validation errors and per-pack failures no longer leak to stderr; they go only into the JSON envelope's `error` / `failed[]` fields. Wrappers that were grepping stderr for error text should read the envelope.
  - **Forward-slash paths** — every CLI display string normalizes `\\` → `/`.

  ## Internals

  New files (selection): `src/install/classify/{types,signals,classify-source,layout-detect,layout-types,marketplace-manifest}.ts` and `src/install/classify/detectors/{fs-helpers,root-shape,collections}.ts`; `src/install/importers/{boilerplate-filter,entity-importers}.ts`; `src/install/lock/install-lock.ts`; `src/install/prompts/{prompt-io,prompt-types,bulk-prompt,broken-link-prompt,modified-files-prompt}.ts`; `src/install/links/{scan-relative-links,resolve-link}.ts`; `src/install/manifest/install-manifest-hash.ts`; `src/install/picker/select-candidates.ts`; `src/install/run/{single-pack-install,route-picker-result,run-install-marketplace,run-install-prompts,run-install-sync-locked,post-install-generate,install-abort-error}.ts`; `src/install/uninstall/{plan-uninstall,detect-modified,legacy-manifest-migration,uninstall-decisions,apply-uninstall,uninstall-result,run-uninstall}.ts`; `src/install/core/{install-target,install-report,pick-reuse-entry-name,remove-extend-entry}.ts`; `src/sources/anthropic-skill-pack/{index,aggregate,merge-commands,link-scan,apply-decisions}.ts`; `src/cli/commands/{uninstall,installs,installs-list}.ts`; `src/cli/renderers/{uninstall,installs}.ts`; `src/utils/filesystem/fs-traverse.ts::readDirRecursiveNoSymlinks`; `src/utils/crypto/hash.ts::hashFileForManifest`.

  File-size discipline (per the project's 200-line cap): `layout-detect.ts` (244 → 116 lines) split into `detectors/` modules; `run-install-locked.ts` (295 → 180 lines) split into `single-pack-install.ts` + `route-picker-result.ts`.

  Coverage: unit-test branch coverage held at 95% across the included set. New: 30+ unit suites and 17 integration tests covering anthropic-pack imports, broken-link / bulk prompt force paths, targeted overrides, backcompat across 5 tool-native fixtures, pack-name preservation, atomicity, every uninstall scenario, `installs list` round-trip, lock contention, marketplace recursion, failure-isolation, dry-run no-op, and CRLF/BOM/symlink hash invariants. Watch-test scheduler envelope hardened (chokidar polling forced in test harness; describe-level timeouts widened).

  Docs: new `cli/uninstall.mdx`, `cli/installs.mdx`, `guides/installing-skill-packs.mdx`, and `docs/architecture/install.md`; expanded `cli/install.mdx`; README env-var table; lessons-file additions documenting the lenient-frontmatter contract, the circular-import trap in target descriptor evaluation, and the FSEvents flake fix.

  ## Upgrade notes
  1. **Plugin authors must add a `metadata` block** to each `TargetDescriptor`. Validation rejects descriptors without it.
  2. **Packs installed before this version** may report some text files as `modified` on the first `uninstall` after upgrade if their content contains CRLF or a BOM. The standard `[d]elete-anyway / [k]eep-modified / [a]bort` prompt covers it (or use `--force` to accept the default). No data is lost. Installs created after upgrade use the new hashing algorithm consistently.
  3. **CI wrappers parsing `--json`** should read errors from the envelope's `error` field rather than scraping stderr.

  ## Deferred to a follow-up

  `src/install/native/native-path-pick-infer.ts` still hardcodes per-target dir prefixes for 8 targets (`gemini-cli`, `claude-code`, `cursor`, `copilot`, `windsurf`, `cline`, `continue`, `junie`, `codex-cli`). The descriptor-driven refactor touches all 27 builtin descriptors plus the three bespoke-layout targets and is tracked separately in `tasks/todo.md`. The file remains in the coverage exclude list with a `category 5` comment until refactored.

- 7cd2c3e: refactor(install): make the skill-pack aggregator delegate per-tool command reads to that target's importer mapper

  `mergeCommands` (the Anthropic skill-pack aggregator's command merger) previously routed every per-tool directory through the canonical `.md`-only parser. That worked for `.claude/commands/` (Claude Code commands are Markdown) but silently dropped `.gemini/commands/*.toml` because Gemini CLI's slash-command format is TOML, not Markdown — even though the gemini-cli target descriptor already ships a TOML-aware mapper (`mapGeminiCommandFile` + `geminiCommandMapper`).

  The aggregator now treats the `target` field on each `CommandMergeSpec` as load-bearing: when set and the target ships a directory-mode command importer with non-`.md` extensions, the aggregator delegates non-`.md` reads to that target's mapper (via the new `readToolNativeCommands`). Markdown files keep going through the canonical reader so dedup metadata keeps pointing at the upstream `.gemini/commands/foo.md`-style path.

  Knock-on cleanups:
  - New `src/install/importers/target-native-commands.ts` — single owner of "read a tool-native command directory through that tool's mapper". Both the descriptor-driven full install (`runDescriptorImport`) and the skill-pack aggregator now share this seam, so adding a new target whose commands aren't Markdown means writing one mapper in that target's descriptor — no aggregator change.
  - `aggregateAnthropicSkillPack` now returns a `cleanup` callback that removes any temp staging directories created by per-target mappers. Wired through the existing `prep.cleanup` lifecycle so `runSinglePackInstall`'s `finally` block runs it after pack materialization.
  - `parseCommands` learns a `handledByOtherReader` option so the canonical reader's "skipped N command file(s)" warning is suppressed for extensions another reader (the per-target mapper) actually consumes.

  Side effect on `addyosmani/agent-skills` and similar multi-tool skill packs: the seven `.gemini/commands/*.toml` files now merge into the canonical command set alongside Claude's `.md` commands instead of triggering the "Skipped 7 commands file(s) … format: .toml" warning. Verified end-to-end: `installs list` shows `8 commands` (4 Claude + 7 Gemini deduped on basename collision), and the previously-dropped Gemini commands are present in `pack/commands/`.

### Patch Changes

- 4c39bd4: fix(install): compound `.md` extensions (e.g. `.agent.md`) stay on the canonical reader

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

- a3e5686: fix(install): skip preserved boilerplate (README/LICENSE/NOTICE/COPYING/COPYRIGHT) in native descriptor import

  Native-import directory mode (`runDirectory` in `descriptor-import-runner.ts`) previously materialized every `*.md` under `.claude/agents/`, `.claude/commands/`, and `.claude/rules/` as a canonical entity. Repos that ship folder-level documentation alongside content (e.g. `.claude/agents/README.md` and `.claude/agents/external/README.md` in `qdhenry/Claude-Command-Suite`) tripped the basename-slug collision check at parse time and hard-failed the install. The runner now consults `isPreservedBoilerplate` and silently drops those files — matching the existing filter applied via `entity-importers.ts` in the install-discovery path. Noise stems (`security`, `contributing`, …) are intentionally left through so user-authored rules like `.claude/rules/security.md` continue to import.

- fc3ec85: fix(install): surface recovery flags in every "no installable resources" error and document the auto-detect → flag fallback chain

  `agentsmesh install <source>` runs the classifier first and falls back to user-supplied flags (`--path`, `--as`, `--target`, `--all`) when auto-detection refuses a source or can't disambiguate it. Three error paths used to dead-end without naming those flags, leaving the user stuck:
  - `No installable files found under <path> for manual install` — now also says: _Try a different `--path`, or omit `--as` to let agentsmesh auto-detect the layout._
  - `No installable native resources found under "<path>" for target "<id>"` (both call sites) — now also says: _Try `--path <dir>` without `--target` for auto-detection, or `--as <kind>` for a flat-collection override._
  - `No installable resources after skipping invalid files (N): …` — now also says: _Fix the frontmatter in the source files (most often: unquoted scalars with embedded colons or square brackets), or narrow `--path` to a subdirectory that excludes them._

  The `agentsmesh install --help` description now spells out the precedence — auto-classify first, then `--path` / `--as` / `--target` / `--all` to override — instead of just listing flags alphabetically.

  Regression tests pin the flag names (not literal phrasing) so the contract stays visible even if future copy-edits rework the sentences.

- 4c39bd4: fix(reference): classify `(filename)` prose as bare-prose, not a Markdown link destination

  `shouldRewritePathToken`'s `(`-branch in
  `src/core/reference/link-token-context.ts` unconditionally treated any
  token preceded by `(` as a Markdown link destination, regardless of
  whether the `[label]` prefix was actually present. Prose mentions
  like `Read the existing spec (SPEC.md or equivalent)` were routed to
  the link-rewrite path; the rebaser then resolved `SPEC.md` against
  the canonical pack's `commands/` dir (case-insensitive on macOS APFS
  / Windows NTFS) and emitted `(../../.agentsmesh/.../SPEC.md or
equivalent)` into every generated `.claude/commands/`,
  `.gemini/commands/`, `.cursor/commands/` artifact (etc.). The leaked
  path was wrong even by intent — the author meant the filename as a
  documentary mention, not a link target.

  The matching guard in `getTokenContext` (same file, line 64) already
  encodes the correct rule: a token is `markdown-link-dest` only when
  `]` sits directly before the `(`. This change propagates that rule
  into `shouldRewritePathToken`:
  - With `]` immediately before `(` → real Markdown link, accept any
    terminator (`)`, `#`, `?`, space, tab) — `[text](spec.md)`,
    `[text](spec.md#anchor)`, etc. continue to rewrite cleanly.
  - Without it → fall through to the bare-token path-shape checks, so
    genuine paths inside parens (`(./commands/spec.md)`,
    `(.claude/skills/foo.md)`) still rewrite via the slash /
    root-relative branches, while bare filenames like
    `(SPEC.md or equivalent)` stay verbatim.

  Verified end-to-end by regenerating against the
  `addyosmani-agent-skills` pack: `(SPEC.md or equivalent)` is now
  preserved in `.gemini/commands/planning.toml`,
  `.claude/commands/planning.md`, `.cursor/commands/planning.md` and the
  24 other targets. The same rule fires identically for `.md`, `.mdc`,
  and `.toml` outputs — the engine is format-agnostic; only the
  classifier's prose-vs-link distinction needed tightening.

  Tests:
  - New `tests/unit/core/link-token-classifier-prose-vs-md-link.test.ts`
    (8 cases) pins the prose-vs-link distinction.
  - `tests/unit/core/link-rebaser-deep-branches.test.ts:396` updated:
    positive cases now require `](` prefix; a new sibling case pins the
    negative behavior for prose forms.

## 0.18.1

### Patch Changes

- d7e3a19: Internal refactor of the skill-import dispatch path and watch-test determinism — no user-visible behavior change.

  **`agentsmesh import` (Cline / Windsurf / Codex CLI)**

  The per-target `readdir → readFileSafe(SKILL.md) → try recognizer → fall back to skill import` loops, which had drifted independently and kept causing the same class of bug (lessons L132), are consolidated behind one shared orchestrator: `importSkillsDirectory(sourceSkillsDirs, options, recognizers)` plus `projectedAgentRecognizer({ canonicalAgentsDir })` and `commandSkillRecognizer({ canonicalCommandsDir })` factories. Each adapter now collapses to a config object plus a recognizer list. A minor side-effect of the consolidation: Cline now performs the same stale-skill-dir cleanup on re-import that Windsurf and Codex already did, so previously orphaned `.agentsmesh/skills/am-agent-<name>/` directories from buggy earlier runs are removed when a Cline projected-agent skill is re-imported.

  **`agentsmesh watch`**

  `runWatch` now accepts an optional `onCycle({ featuresChanged })` callback fired once per completed generate cycle (initial + each debounced regen). This is a deterministic synchronization signal for tests/integrations that previously relied on scraping `'Regenerated.'` log lines. The unrelated, dead `_suppressAgentsmeshDirUntil` parameter is removed from `shouldIgnoreWatchPath`. Watch-test budget bumped from 45s → 60s base (×1.5 under coverage = 90s) to survive full-suite scheduler load on macOS FSEvents.

  **Developer tooling**

  New `pnpm flake:watch` script (`scripts/flake-check-watch.ts`) runs the watch unit suite N times under `COVERAGE=1` to validate stability whenever the watch loop or scheduler envelope changes.

  **Internal**
  - New file: `src/targets/import/shared/skill-import-pipeline.ts` gains `importSkillsDirectory`, `projectedAgentRecognizer`, `commandSkillRecognizer`, `SkillRecognizer`, `SkillRecognizerContext` exports. The dead `SkillImportOptions.sourceSkillsDir` field is removed; `sourceSkillsDirs` is now a required first argument to the orchestrator.
  - Adapter migrations: `cline/skills-adapter.ts`, `windsurf/skills-adapter.ts`, `codex-cli/skills-adapter.ts` reduced to thin wrappers. `cursor/skills-adapter.ts` and `copilot/skills-adapter.ts` shed the now-dead option field.
  - 17 new unit tests; touched-scope branch coverage at 100% (25/25).
  - `runWatch` adds `RunWatchOptions` + `WatchCycleInfo` types. The new third parameter is optional and backwards-compatible.

## 0.18.0

### Minor Changes

- 7c57018: Replace the AGENTS.md content-normalization logic with a shared-path rewrite skip. When two or more active targets emit the same root-instruction path (most commonly `AGENTS.md`), every copy keeps canonical `.agentsmesh/...` references instead of being rewritten to target-specific paths. The collision resolver then merges the byte-identical copies trivially.

  **User-visible behavior change**

  The single `AGENTS.md` at the project root now contains references like `.agentsmesh/skills/<name>/SKILL.md` rather than the previous `.agents/skills/<name>/SKILL.md` (or any other target-specific prefix). Tools reading `AGENTS.md` follow the path literally and find the file under `.agentsmesh/`, which is always present as the canonical source of truth. Each target's own directory (`.agents/skills/`, `.factory/skills/`, etc.) is still generated and its files still receive normal per-target reference rewriting — only the shared root-instruction file uses canonical paths.

  **Why**

  The previous approach generated N copies of `AGENTS.md`, rewrote their references to N different target-specific paths, and then ran ~200 lines of fragile reverse-normalization to prove they were "actually the same". That logic carried hardcoded target IDs, regex bare-path anchoring, and reverse reference maps — every new target risked breaking it. The new approach is structural: skip rewriting when a path is claimed by 2+ targets as their root instruction (detected via descriptor `rootInstructionPath` + `outputFamilies` of kind `'additional'`), so the content stays byte-identical and collision merge is a no-op. Plugin targets that declare a `rootInstructionPath` get the same treatment automatically — no per-target opt-in needed.

  **Internal**
  - Drops `src/targets/catalog/agents-md-overlap.ts` (199 lines) and its test file
  - Adds `computeSharedRootInstructionPaths()` to `engine.ts` (descriptor-driven, no hardcoded target IDs)
  - Adds an optional `skipPaths: ReadonlySet<string>` parameter to `rewriteGeneratedReferences()`
  - Drops gemini-cli's legacy pre-emptive `.agentsmesh/skills/` → `.agents/skills/` substitution in `generateRules` — no longer needed under the new approach
  - 28 new tests across `tests/unit/core/shared-root-instruction-paths.test.ts`, `reference-rewriter-shared-paths.test.ts`, and `tests/contract/shared-agents-md.test.ts`

- 7c57018: Add six new built-in targets: `deepagents-cli`, `factory-droid`, `jules`, `pi-agent`, `replit-agent`, and `rovodev`. Each ships with project and global mode support, full feature generators (rules, skills, MCP, hooks, ignore, permissions where applicable), an importer, capability-focused unit tests, and integration coverage for the import + generate round-trip. The new targets appear automatically in the support matrix, the import target table, and every auto-generated tool list — no manual doc edits required to discover them.
- 7c57018: Add a required `metadata` field to `TargetDescriptor` and a new `TARGET_REGISTRY` aggregator that drives every user-facing target listing in README and the website. Plugin and built-in targets now declare display name, category, official URL, and a one-line description in a single place; the TypeScript compiler enforces completeness.

  **New public surface**
  - `TargetMetadata` interface (`displayName`, `category: 'cli' | 'ide' | 'agent-platform'`, `officialUrl`, `shortDescription`) exported from `src/targets/catalog/target-descriptor.ts`.
  - `TARGET_REGISTRY: Readonly<Record<BuiltinTargetId, TargetEntry>>` plus `listTargets()`, `targetsByCategory()`, and `primaryImportRoot()` helpers exported from `src/targets/catalog/target-metadata-registry.ts`.
  - Every `TargetDescriptor.metadata` is required at compile time; the field is now part of the contract for plugin authors.

  **Plugin authors — what to do**

  If you ship a `TargetDescriptor` from a plugin package, add the `metadata` block immediately after `id:`:

  ```typescript
  export const descriptor = {
    id: 'my-tool',
    metadata: {
      displayName: 'My Tool',
      category: 'cli',
      officialUrl: 'https://example.com',
      shortDescription: 'One-line description used in tool lists',
    },
    // ...rest unchanged
  } satisfies TargetDescriptor;
  ```

  The TypeScript compiler will fail if any field is missing or mistyped. The metadata appears in any auto-generated tool list a consumer renders — there is no separate registration step.

  **Tooling updates**
  - `agentsmesh target scaffold <id>` now emits a `metadata` block with `TODO(agentsmesh-scaffold)` markers that fail to compile until the author fills them in.
  - The `add-agent-target` skill and `target-addition-checklist.md` reference list the metadata fields in Phase 1 research; the `add-new-target-playbook.md` walks through filling them.

### Patch Changes

- 7c57018: Auto-generate every user-facing target listing from `TARGET_REGISTRY`, and reposition install methods so AgentsMesh is no longer presented as Node-only.

  **Auto-generated target listings**

  `pnpm matrix:generate` now writes three new auto-generated marker blocks in addition to the existing project/global feature matrices:
  - `tool-list` (README + homepage) — every target grouped by category with links to the official tool URL
  - `import-targets` (`cli/import.mdx`) — all 30 targets with their primary read path
  - `tool-details` (`reference/supported-tools.mdx`) — uniform per-target sections with display name, category, official URL, project + global root paths, and skill directory

  `pnpm matrix:verify` (CI gate) fails the build whenever any of the four documents drift from the catalog. The render script was split into `scripts/support-matrix-blocks.ts` (pure builders) and a slim orchestrator.

  **Hardcoded enumerations removed**

  Replaced with links to the support matrix or generated content:
  - README import-target list (was 13/30) and tool-format examples
  - Homepage prose enumeration of 15+ tools
  - `cli/import.mdx` per-target source→canonical mapping tables (only 7/30 documented) — collapsed into a single canonical-pattern table plus editorial caveats for the 5 targets with real implementation quirks
  - `cli/init.mdx` auto-detection list (12 hardcoded paths) and starter-config example
  - `cli/generate.mdx` output-locations table (was 12/30)
  - `canonical-config/commands.mdx` + `canonical-config/hooks.mdx` per-target feature support enumerations
  - `reference/supported-tools.mdx` per-tool detail sections (was 24/30 hand-written, ~494 lines) replaced with the auto-generated `tool-details` block covering all 30 targets uniformly

  **Install repositioning**

  AgentsMesh now presents three install methods as equals — Homebrew (no Node.js required), standalone binary (no Node.js required), and npm/pnpm/yarn (Node.js 20+). The `getting-started/installation.mdx` page rewrite uses a Tabs block with a "which method should I use?" comparison table. The README install section was reordered (Homebrew first, npm last) and `npx agentsmesh ...` was stripped from every non-install code sample — `npx` survives only in the two explicit "run without installing" snippets where it's the legitimate use. CI workflow examples, guides, and command-reference pages now use the plain `agentsmesh` binary, which works after any install method (with `npx` documented as the prefix for users who chose `npm install -D`).

## 0.17.0

### Minor Changes

- e45befe: Add 6 P0-TierA targets: Aider, Amazon Q Developer, Augment Code, Crush, Qwen Code, and Trae

  New built-in targets with full project and global mode support:
  - **Aider** — `CONVENTIONS.md`, `.aider/skills/`, `.aiderignore`
  - **Amazon Q Developer** — `.amazonq/rules/*.md`, `.amazonq/mcp.json`
  - **Augment Code** — `.augment/rules/`, `.augment/commands/`, `.augment/skills/`, `.augment/settings.json`, `.augmentignore`
  - **Crush** — `CRUSH.md`, `.crush/skills/`, `crush.json` (MCP + hooks + permissions), `.crushignore`
  - **Qwen Code** — `QWEN.md`, `.qwen/rules/`, `.qwen/commands/`, `.qwen/agents/`, `.qwen/skills/`, `.qwen/settings.json`, `.qwenignore`
  - **Trae** — `.trae/rules/`, `.trae/skills/`, `.trae/mcp.json`, `.trae/.ignore`

  All targets include: descriptor, generator, importer, linter, import-map, fixtures, unit tests, global-layout tests, contract definitions, and branch coverage tests. Catalog grows from 18 to 24 builtin targets.

## 0.16.0

### Minor Changes

- 0b33c0d: Security and robustness hardening across MCP write tools, hook script generation, remote fetch, and canonical name validation. Some changes are behaviorally breaking; pre-1.0 minor bump per project policy.

  **Hardening (no contract change)**
  - MCP `add_mcp_server` / `update_mcp_server` / `update_hooks` / `update_permissions` now reject obviously malicious payloads at the schema layer (shell metacharacters in `command`, embedded newlines in matchers, env keys outside `[A-Za-z_][A-Za-z0-9_]*`, non-`http(s)` URLs, args arrays over 100, unknown server fields, permission patterns outside `Tool` / `Tool(matcher)`).
  - Generated Copilot and Cline hook wrappers strip CR/LF from event/matcher/command before embedding them in the `# agentsmesh-*:` comment header so a multi-line YAML scalar cannot break out of the comment into executable shell.
  - Generated `.sh` / `.bash` / `.zsh` files are now written with mode `0o755` so hooks emitted to disk are exec'able by the runner without a manual `chmod +x`.
  - GitHub tarball downloads are capped at 500 MiB and aborted mid-stream when the running byte total exceeds the cap (Content-Length is also pre-checked).
  - Git refs and clone URLs that begin with `-` are rejected to block `--upload-pack=…` style option injection.
  - `MCP` non-`McpError` fallbacks redact absolute filesystem paths from raw `Error.message` strings; `IO_ERROR` envelopes carry the underlying `errno` in `details`.
  - `parseAgents` / `parseCommands` / `parseRules` / `parseSkills` reject canonical filenames that are Windows reserved devices (CON, AUX, NUL, COM1–9, LPT1–9), contain `<>:|?*`, or end in `.`/space; nested basename collisions (e.g. `agents/foo.md` and `agents/sub/foo.md`) now error instead of silently last-write-wins.
  - `loadAllPlugins` now collects all per-plugin failures and rethrows as a single combined error when any entry has `strict: true` or `AGENTSMESH_STRICT_PLUGINS=1` is set in the environment. Previous warn-and-skip behavior remains the default.

  **Breaking**
  - Generated hook wrappers run under `set -eu` instead of `set -e`. A canonical `command` that references an unset shell variable (`echo $VAR` where `$VAR` is never exported) will now abort the hook. Use `${VAR:-default}` syntax when an unset value is intentional.
  - `AGENTSMESH_CACHE` must now be an absolute path that is not the filesystem root (`/` or a Windows drive root). Relative paths and roots throw at startup. Previously the value was used verbatim.
  - MCP `create_rule` / `create_command` / `create_agent` and the canonical handlers reject names containing `/`. The `NAME_RE` validator was tightened from `[a-zA-Z0-9_/-]*` to `[a-zA-Z0-9_-]*` — names must be flat identifiers.
  - Canonical files named after Windows reserved devices or with reserved characters now throw `CanonicalNameError` at parse time on every host (previously silent failure on Windows, success on POSIX).

  **Internal**
  - `src/mcp/register.ts`, `src/utils/filesystem/fs.ts`, `src/mcp/handlers/orchestrate.ts`, and `src/cli/commands/target-scaffold/templates.ts` were each split under the project's 200-line file budget. Public API surface (`./engine`, `./canonical`, `./targets`) is unchanged.
  - New `executableModeFor(path)` helper in `src/utils/filesystem/fs.ts` infers the executable bit from the path extension; `writeFileAtomic` accepts an optional `{ mode }` override.

## 0.15.0

### Minor Changes

- 1edb936: Homebrew tap and standalone-binary distribution. `brew tap samplexbro/agentsmesh && brew install agentsmesh` installs from a Homebrew formula auto-rendered against the published npm tarball; `curl -fsSL https://github.com/sampleXbro/agentsmesh/releases/latest/download/install.sh | sh` downloads a Node-free Bun-compiled binary for macOS (arm64/x64) and Linux (arm64/x64), verifies SHA256, installs to `~/.agentsmesh/bin`, and adds it to PATH for zsh, bash, and fish. The release workflow builds binaries for every supported platform on each `master` push, attaches them to a GitHub Release alongside `SHA256SUMS`, and pushes the formula to the tap repo; `workflow_dispatch` re-runs rebuild assets against an existing tag. Installer fails closed on missing/unverifiable checksums and rejects shell-unsafe `AGENTSMESH_INSTALL` paths.

## 0.14.0

### Minor Changes

- 16a7f0d: Self-serve MCP server. `agentsmesh mcp` boots a stdio MCP server exposing 41 tools and 16 resources for canonical config introspection, CRUD on rules/commands/agents/skills, settings management (config/mcp-servers/permissions/hooks/ignore), capability matrix queries, and orchestration verbs (generate/lint/check/diff/import/convert). Auto-registered in `.agentsmesh/mcp.json` on `init` and `import`. See the MCP server reference page.

## 0.13.0

### Minor Changes

- f68ab67: feat(cli): add convert command for direct tool-to-tool migration

  Adds `agentsmesh convert --from <source> --to <target>` for direct tool-to-tool conversion without going through canonical setup. Internally chains the existing import and generate pipelines via a temporary directory, producing destination tool files from source tool files in a single command. Supports `--dry-run` and `--json` flags.

- c8d58c0: feat(cli): add structured JSON output mode

  Adds `--json` support across CLI commands so automation and CI can consume stable machine-readable command results. JSON mode returns structured success/error envelopes while keeping the existing human-readable output as the default.

## 0.12.0

### Minor Changes

- 11c0d58: feat(amp): add Amp (Sourcegraph) as a new built-in target

  Amp is a coding agent by Sourcegraph (ampcode.com). This adds full project and global mode support:
  - **Rules**: `AGENTS.md` (root + embedded additional rules)
  - **Skills**: `.agents/skills/*/SKILL.md` skill bundles (shared path with Codex CLI, consumer role)
  - **MCP**: `.amp/settings.json` under `amp.mcpServers` key with settings merge
  - **Global mode**: `~/.config/amp/AGENTS.md`, `~/.config/amp/skills/`, `~/.config/amp/settings.json`
  - Commands and agents projected as skills via `supportsConversion`
  - Lint warnings for unsupported features (hooks, ignore, permissions)

- fa8e208: feat(warp): add Warp as a new built-in target

  Warp is an agentic development environment by Warp.dev. This adds project and global mode support:
  - **Rules**: `AGENTS.md` (root + embedded additional rules); legacy `WARP.md` supported on import
  - **Skills**: `.warp/skills/` with YAML frontmatter skill bundles
  - **MCP**: `.mcp.json` at project root (standard format, shared with Claude Code)
  - **Commands/Agents**: projected as skills via `supportsConversion`
  - **Global mode**: `~/.warp/skills/` (skills only — global rules are UI-managed via Warp Drive)
  - Lint warnings for unsupported features (hooks, ignore, permissions)

- bfc0a57: feat(zed): add Zed as a new built-in target

  Zed is a modern code editor with a built-in AI assistant (zed.dev). This adds project and global mode support:
  - **Rules**: `.rules` (root + embedded additional rules in a single file)
  - **MCP**: `.zed/settings.json` under `context_servers` key with settings merge
  - **Global mode**: `~/.config/zed/settings.json` (MCP only — no global rules file)
  - Lint warnings for unsupported features (hooks, ignore, permissions)

## 0.11.0

### Minor Changes

- 85b8601: feat(goose): add Goose (Block) as a new built-in target

  Goose is an open-source AI coding agent by Block (goose-docs.ai). This adds full project and global mode support:
  - **Rules**: `.goosehints` (root + embedded additional rules)
  - **Skills**: `.agents/skills/*/SKILL.md` skill bundles (shared path with Codex CLI)
  - **Ignore**: `.gooseignore` with gitignore-style patterns
  - **Global mode**: `~/.config/goose/.goosehints`, `~/.config/goose/.gooseignore`, `~/.agents/skills/`
  - Lint warnings for unsupported features (commands, hooks, MCP, permissions)

- ca7e48f: feat(opencode): add OpenCode as a new built-in target

  OpenCode (opencode.ai) is an open-source AI coding agent CLI/TUI. This adds full project and global mode support:
  - **Rules**: `AGENTS.md` (root) + `.opencode/rules/*.md` (additional)
  - **Commands**: `.opencode/commands/*.md` with description frontmatter
  - **Agents**: `.opencode/agents/*.md` with mode/description/model frontmatter
  - **Skills**: `.opencode/skills/*/SKILL.md` skill bundles
  - **MCP**: `opencode.json` with native format conversion (array `command`, `environment` key)
  - **Global mode**: `~/.config/opencode/` with full feature parity
  - Lint warnings for unsupported features (hooks, ignore, permissions)

## 0.10.0

### Minor Changes

- c4fb261: Add `kilo-code` as a new built-in target. Kilo Code is a multi-surface AI coding platform (VS Code extension, JetBrains plugin, CLI, cloud agent) and a fork of Roo Code (which is a fork of Cline).

  Generation always uses Kilo's new layout: `AGENTS.md` (root), `.kilo/rules/`, `.kilo/commands/`, `.kilo/agents/` (first-class subagents), `.kilo/skills/`, `.kilo/mcp.json`, and `.kilocodeignore`. Import covers BOTH the new layout and Kilo's legacy layout (`.kilocode/`, `.kilocodemodes`) so existing kilo / Roo-era projects round-trip cleanly.

  Capabilities (project + global):
  - `rules`, `additionalRules`, `commands`, `agents`, `skills`, `mcp`, `ignore`: native
  - `hooks`: none — Kilo Code has no user-facing lifecycle hook system; canonical hooks emit a lint warning.
  - `permissions`: none — Kilo permissions live in `kilo.jsonc`, which agentsmesh does not generate in v1; canonical permissions emit a lint warning.

  Global mode generates under `~/.kilo/` (`AGENTS.md`, `rules/`, `commands/`, `agents/`, `skills/`, `mcp.json`) plus `~/.kilocodeignore`, and mirrors skills into `~/.agents/skills/` for cross-tool compatibility (suppressed when `codex-cli` is also active).

  Use `agentsmesh import --from kilo-code` to migrate existing Kilo projects (new or legacy layout) into canonical `.agentsmesh/`, then `agentsmesh generate --targets kilo-code` to project them back as the documented new layout.

- 5d6cfbb: Sequential `agentsmesh import --from <target>` runs now merge MCP servers by name into `.agentsmesh/mcp.json` instead of replacing the whole file. Existing canonical entries are preserved and the imported set wins on name collision, so a `claude-code` import followed by a `cursor` import keeps both targets' servers in canonical state.

  Affects every importer that writes `mcp.json`: `claude-code` (`.claude/settings.json` + `.mcp.json` + `~/.claude/.mcp.json`), `codex-cli` (`config.toml`), `continue`, `cursor`, and any descriptor-driven importer using `mode: 'mcpJson'`. The previous behavior — last import overwrites the file and silently drops earlier servers — is gone.

  Also fixed: a build-time regression where `writeMcpWithMerge` was referenced by five importers without the backing module being shipped, breaking `tsc --noEmit` for consumers building from source.

## 0.9.0

### Minor Changes

- b3f702d: Adds three new `agentsmesh lint` diagnostics, a recommended `.gitignore` policy for materialized packs, and a one-step `agentsmesh target-scaffold` workflow.

  Added:
  - New lint diagnostics, all emitted as warnings (do not change `lint`'s exit code):
    - `silent-drop-guard` flags canonical content a target would otherwise drop without trace based on its capability map.
    - `hook-script-references` warns when a hook command references a script path for any target whose generator does not copy hook scripts into its output. **All built-in targets except Copilot fall under this rule today.** Existing hook configs that reference local script paths (e.g. `./scripts/pre-commit.sh`) will surface a new warning per matching target on the first lint after upgrade. The script must already exist relative to the hook execution directory or the generated config will fail at runtime — the diagnostic just makes the gap visible.
    - `rule-scope-inversion` catches manual-activation rules whose scope contradicts the target's projection rules.
      All three are wired into `runLint` for every target via descriptor capabilities; no existing rule has been removed and no diagnostic is upgraded to error severity.
  - `agentsmesh init` now writes `.agentsmesh/packs/` into `.gitignore` alongside `agentsmesh.local.yaml`, `.agentsmeshcache`, and `.agentsmesh/.lock.tmp`, and skips entries already covered by a broader pre-existing pattern (e.g. an existing `.agentsmesh/` line covers `.agentsmesh/packs/`). Materialized packs are treated like `node_modules` — `installs.yaml` is committed and `agentsmesh install --sync` reproduces the tree deterministically post-clone.
  - `agentsmesh target-scaffold` post-steps collapse the previous three-edit sequence into one `pnpm catalog:generate` invocation, backed by a new auto-discovered builtin-target catalog (`scripts/generate-target-catalog.ts` + `pnpm catalog:verify` drift guard in CI).

  Changed:
  - The `agentsmesh.json` and `pack.json` schemas now list `targets` enums alphabetically. Schema consumers that pin order will see a one-time diff; values are unchanged.
  - README documents the commit-vs-gitignore convention for generated tool folders and clarifies native Windows support (no WSL).

  Internal:
  - Per-target importers (`antigravity`, `claude-code`, `continue`, `copilot`, `cursor`, `gemini-cli`, `junie`, `kiro`, `roo-code`) migrated to the descriptor-driven import runner with mapper functions extracted into `import-mappers.ts` to keep `index.ts` ↔ `importer.ts` cycles out of the TDZ.
  - New shared link-format registry (`src/core/reference/link-format-registry.ts`) consolidates per-target link rendering rules.
  - `writeFileAtomic` now refuses to follow a pre-existing symlink at the target path (closes a TOCTOU window where a swapped symlink could redirect writes outside the project tree).
  - `agentsmesh plugin add` now warns that plugins load as trusted Node.js modules with full process privileges.

### Patch Changes

- 08ef1b0: Security hardening and correctness fixes across install, generate, reference rewriting, plugin loading, and caching subsystems.

  Fixed:
  - `agentsmesh install --path` now rejects paths that traverse outside the install source root, closing a directory-escape vulnerability where `--path ../../outside` could read files outside the fetched source.
  - Pack names are validated as single directory segments before materialization — values containing path separators (e.g. `../../escape`) are rejected, preventing writes outside `.agentsmesh/packs/`.
  - `writeFileAtomic` now checks the `.tmp` staging path for symlinks before writing, closing a TOCTOU window where a symlink at `${path}.tmp` could redirect writes to an attacker-controlled location.
  - `agentsmesh generate --targets` now validates filter values against configured targets and errors on unknown names. Previously a misspelled target silently produced zero outputs and `--check` reported success, allowing CI to pass while checking nothing.
  - Project-scope skill mirrors now receive source-map entries for reference rewriting. Previously only global-scope mirrors were mapped, leaving Markdown links inside project-mirrored skill files unrewritten.
  - Plugin targets declaring `sharedArtifacts` are now recognized during global reference rewriting. Previously only builtin target descriptors were consulted, so plugin-owned shared paths could be rebased through the wrong artifact map.
  - `runDescriptorImport` is now exported from `agentsmesh/targets` as documented in the plugin guide.
  - Importer fallback sources are now tried when configured primary files are absent on disk, not only when the primary source list is empty.
  - `flatFile` and `mcpJson` import modes now honor `canonicalDir` when `canonicalFilename` is a bare filename, matching the documented directory-plus-filename contract for plugin descriptor authors.
  - Rule path mapping uses POSIX `basename` with backslash normalization instead of host `node:path`, preventing broken slugs when Windows-shaped canonical paths appear on a POSIX host.
  - Relative `file:` plugin sources now resolve against `projectRoot` instead of the filesystem root.
  - Remote cache keys now preserve dots and use double-separator delimiters so distinct refs like `v1.0.0` and `v1_0_0` no longer collide. Existing cached entries will be re-fetched once after upgrade.

## 0.8.0

### Minor Changes

- b3f702d: Adds three new `agentsmesh lint` diagnostics, a recommended `.gitignore` policy for materialized packs, and a one-step `agentsmesh target-scaffold` workflow.

  Added:
  - New lint diagnostics: `silent-drop-guard` flags canonical content a target would otherwise drop without trace, `hook-script-references` reports hook commands pointing at missing wrapper scripts, and `rule-scope-inversion` catches manual-activation rules whose scope contradicts the target's projection rules. They are wired into `runLint` for every target via descriptor capabilities, so existing configs may surface new warnings; no rule has been removed.
  - `agentsmesh init` now writes `.agentsmesh/packs/` into `.gitignore` alongside `agentsmesh.local.yaml`, `.agentsmeshcache`, and `.agentsmesh/.lock.tmp`. Materialized packs are treated like `node_modules` — `installs.yaml` is committed and `agentsmesh install --sync` reproduces the tree deterministically post-clone.
  - `agentsmesh target-scaffold` post-steps collapse the previous three-edit sequence into one `pnpm catalog:generate` invocation, backed by a new auto-discovered builtin-target catalog (`scripts/generate-target-catalog.ts` + `pnpm catalog:verify` drift guard in CI).

  Changed:
  - The `agentsmesh.json` and `pack.json` schemas now list `targets` enums alphabetically. Schema consumers that pin order will see a one-time diff; values are unchanged.
  - README documents the commit-vs-gitignore convention for generated tool folders and clarifies native Windows support (no WSL).

  Internal:
  - Per-target importers (`antigravity`, `claude-code`, `continue`, `copilot`, `cursor`, `gemini-cli`, `junie`, `kiro`, `roo-code`) migrated to the descriptor-driven import runner with mapper functions extracted into `import-mappers.ts` to keep `index.ts` ↔ `importer.ts` cycles out of the TDZ.
  - New shared link-format registry (`src/core/reference/link-format-registry.ts`) consolidates per-target link rendering rules.

## 0.7.0

### Minor Changes

- 5179de0: Native Windows support is now first-class. `windows-latest` × Node 22 joins `ubuntu-latest` × Node 20/22/24 and `macos-latest` × Node 22 in the CI quality matrix, the `os: ["darwin", "linux"]` restriction is removed from `package.json`, and the README/website call out Linux, macOS, and Windows as equally supported platforms.

  The install/pack persistence layer is now separator-agnostic: `installs.yaml` `source`/`path`/`paths` and `pack.yaml` local-source fields are always serialized as POSIX through the new `src/install/core/portable-paths.ts` helper, regardless of the host separator. `agentsmesh install <local-path>` parses Windows paths (including cross-drive sources and `.agentsmesh/` segments split by backslashes) into portable manifest entries, and legacy manifests written on Windows are normalized on read so existing repos converge without migration. `agentsmesh import --from windsurf` and `--from codex-cli` now detect nested `AGENTS.md` / `AGENTS.override.md` via `basename(srcPath)`; the previous `srcPath.endsWith('/AGENTS.md')` check silently skipped nested rules on Windows because `readDirRecursive` returns native separators. `scripts/flake-check.ts` resolves `pnpm.cmd` on `win32`, and `tests/helpers/node-bin.ts` is the single source for `node_modules/.bin/<name>` shim resolution across platforms.

  A new Windows path-safety contract (`src/utils/filesystem/windows-path-safety.ts` plus `tests/contract/windows-path-safety.matrix.test.ts`) asserts that every generated artifact path emitted by every builtin target — in both project and global scope — survives a Windows clone/checkout/write cycle. Reserved device names (case-insensitive `CON`/`PRN`/`AUX`/`NUL`/`COM1-9`/`LPT1-9`), reserved characters (`<>:"|?*` plus ASCII control chars), trailing dots/spaces, and case-only collisions on default NTFS / APFS volumes are now regression-locked across 48 contract assertions.

  `agentsmesh lint` warns when `hooks.yaml` is non-empty for `cline` or `copilot`, because both targets emit `.sh` wrapper scripts (`.clinerules/hooks/*.sh`, `.github/hooks/scripts/*.sh`) with `#!/usr/bin/env bash` headers that need a POSIX shell (git-bash or WSL) to execute on Windows. Other targets (claude-code, cursor, windsurf, kiro, gemini-cli) embed the user's `command` string directly into JSON config and stay fully portable. The Windows portability story for hooks is documented in `website/src/content/docs/canonical-config/hooks.mdx`.

  Also fixed: `tests/integration/lint.integration.test.ts` stops hardcoding `shell: '/bin/sh'` plus `2>&1` for stderr capture (which ENOENTed on Windows runners) — it now spawns `process.execPath` via `spawnSync` and concatenates the captured streams.

  Fixed a long-latent race in `acquireProcessLock` (`src/utils/filesystem/process-lock.ts`) that surfaced the test failure `ENOENT: rename .agentsmesh/.lock.tmp -> .agentsmesh/.lock` under parallel `agentsmesh generate` invocations. Between `mkdir(lockPath)` succeeding and `writeFile(holder.json)` completing, a competing acquirer would treat the metadata-less lock dir as orphaned, evict it, and silently steal the mutex — letting both processes into the critical section and racing their `writeFileAtomic` writes. The lock now treats lock dirs younger than a 2-second grace window as held even when `holder.json` is missing, and only evicts genuinely orphaned older directories. Covered by `tests/integration/generate-process-lock.integration.test.ts` plus a new unit test in `tests/unit/utils/process-lock.test.ts`.

  Fixed a generator-side Windows path bug surfaced by the Windows CI matrix: rule slug extraction in `src/targets/{claude-code,codex-cli,copilot,cursor,continue,catalog}/...` used `rule.source.split('/').pop()!.replace(/\.md$/, '')`, which on Windows where `rule.source` uses `\` separators returned the _entire absolute path_ and produced `.cursor\rules\C:\Users\...\.agentsmesh\rules` ENOENT crashes during `writeFileAtomic`. All 10 occurrences across 8 files now use `basename(rule.source, '.md')` from `node:path`, which is platform-aware. Watch mode in `src/cli/commands/watch.ts` now sets `usePolling: process.platform === 'win32'` because Windows native `ReadDirectoryChangesW` misses events for files newly created in just-watched subdirectories under the GitHub Actions `AppData\Local\Temp` short-name path.

  Fixed a second Windows path bug in the reference rewriter: `buildArtifactPathMap`, `addPackSkillArtifactMappings`, `applyCopilotInstructionArtifactRefs`, `collectPlannedPaths`, and the validator in `src/core/reference/validate-generated-markdown-links.ts` were using native `node:path.join`/`normalize` directly. The rebaser itself uses `pathApi(projectRoot)` which picks `win32` or `posix` based on the _path format_, not the host platform. Synthetic POSIX project roots (used in unit tests) and real Windows project roots could produce mismatched keys vs. lookups, so the rewriter silently no-op'd. All five sites now share one `pathApi(projectRoot)` so map keys and lookups always agree.

## 0.6.0 - 2026-04-25

### Added

- **Full plugin parity with built-in targets** — plugin targets now have access to the same runtime capabilities as built-in targets:
  - **Conversion support**: plugins can declare `supportsConversion: { commands: true, agents: true }` and users can configure `commands_to_skills` / `agents_to_skills` for plugin target IDs in `agentsmesh.yaml`. The conversion schema now accepts arbitrary target IDs alongside hardcoded builtins. Conversion values support per-scope control: `foo-ide: { project: true, global: false }` or the shorthand `foo-ide: true` for both scopes.
  - **Global mode**: plugin descriptors that define `global` or `globalSupport` layouts, `globalCapabilities`, and `globalDetectionPaths` are fully resolved by the engine — `generate --global`, `import --global`, `lint --global`, and `matrix --global` all work with plugin targets.
  - **Scoped settings emission**: `emitScopedSettings` hooks on plugin descriptors are now called during generation (previously only checked on builtins).
  - **Hook post-processing**: `postProcessHookOutputs` hooks on plugin descriptors are now called during the hook generation pass.
  - **Per-feature lint hooks**: `lint.commands`, `lint.mcp`, `lint.permissions`, `lint.hooks`, and `lint.ignore` on plugin descriptors receive `{ scope }` context for project vs global differentiation.
  - **Unified generator resolution**: a single code path (`resolveTargetFeatureGenerator`) resolves generators for both builtins and plugins, removing duplicate resolution logic from the engine.
- **Plugin support in all CLI commands** — `diff`, `check`, `matrix`, and `import --from <plugin-id>` now bootstrap and resolve plugin targets. Previously only `generate` and `lint` supported plugins.
- **Richer target scaffold** — `agentsmesh target scaffold` now generates descriptors with global layout, `globalCapabilities`, `globalDetectionPaths`, `supportsConversion`, per-feature lint hook stubs, and `rewriteGeneratedPath` for global path rewriting.
- **Comprehensive plugin test fixture** (`tests/fixtures/plugins/rich-plugin/`) — covers 100% of `TargetDescriptor` fields including all 8 feature generators, per-feature lint hooks, project and global layouts with output families, shared artifacts, scope extras, scoped settings, hook post-processing, and conversion support.
- **Typed root barrel export** — `import { generate, importFrom, loadCanonical, registerTargetDescriptor } from 'agentsmesh'` now resolves to a proper `.d.ts` under strict TypeScript. The root `exports."."` is a conditional block with `types`, `import`, and `default`, pointing at a new public barrel (`src/public/index.ts`). Closes `TS7016: Could not find a declaration file for module 'agentsmesh'` that appeared for any downstream TS consumer.
- **Typed error taxonomy exported from the public API** — `AgentsMeshError` base class plus 8 concrete subclasses (`ConfigNotFoundError`, `ConfigValidationError`, `TargetNotFoundError`, `ImportError`, `GenerationError`, `RemoteFetchError`, `LockAcquisitionError`, `FileSystemError`), each carrying a stable `code` field (`AM_CONFIG_NOT_FOUND`, `AM_CONFIG_INVALID`, `AM_TARGET_NOT_FOUND`, `AM_IMPORT_FAILED`, `AM_GENERATION_FAILED`, `AM_REMOTE_FETCH_FAILED`, `AM_LOCK_ACQUISITION_FAILED`, `AM_FILESYSTEM`). Programmatic consumers can branch on `err instanceof ConfigNotFoundError` or `err.code === 'AM_CONFIG_INVALID'` without parsing error message strings. Error throw sites in `src/config/core/loader.ts` and `src/utils/filesystem/fs.ts` now emit typed errors; stack-trace context and `cause` chains preserved.
- **Canonical domain types in the public barrel** — 14 types (`CanonicalFiles`, `CanonicalRule`, `CanonicalCommand`, `CanonicalAgent`, `CanonicalSkill`, `SkillSupportingFile`, `Permissions`, `IgnorePatterns`, `McpServer`, `StdioMcpServer`, `UrlMcpServer`, `McpConfig`, `Hooks`, `HookEntry`) are now exported from `agentsmesh` and `agentsmesh/canonical`. Programmatic consumers can finally type the result of `loadCanonical()` without reaching into internal modules.
- **Process-level lock for concurrent `generate`** — `agentsmesh generate` acquires an atomic mkdir-based lock at `.agentsmesh/.generate.lock` before writing. Concurrent generates serialize cleanly; stale locks (dead PID on the same host, or age > 60 seconds) are evicted automatically; `SIGINT`/`SIGTERM`/normal exit release the lock idempotently. Dry-run and check-only modes skip the lock. Watch mode's lock-file ignore list was extended so self-triggered generate passes do not retrigger the watcher.
- **Cross-platform CI matrix** — quality gates now run on `ubuntu-latest` × Node 20/22/24, plus `windows-latest` × Node 22 and `macos-latest` × Node 22. Previously only `ubuntu-latest` × Node 22. E2E tests run on Linux and macOS; Windows runs lint/typecheck/unit/build.
- **Packaging guards in CI** — three new gates run on every push in a dedicated `smoke` job:
  - `publint` — package.json metadata sanity (exports ordering, `files`, module type).
  - `@arethetypeswrong/cli` with the `esm-only` profile — verifies every public entrypoint resolves to types under `node16 (from ESM)` and `bundler` module resolution.
  - `tests/consumer-smoke/` — packs the tarball, installs it into a throwaway strict-mode TS project, and runs `tsc --noEmit` against every public symbol (runtime functions, canonical types, target-descriptor types, and error classes). Catches `TS7016` and type-resolution regressions that packaging-metadata checks miss.
  - Also runnable locally via `pnpm publint`, `pnpm attw`, `pnpm consumer-smoke`.
- **Post-pack smoke test in CI** — the `smoke` job installs the packed tarball with `npm install -g` and verifies `agentsmesh --version`, `agentsmesh --help`, `amsh --version`, and `agentsmesh init --yes` all succeed in a clean temp project. Catches broken shebangs, missing files from the `files` array, and bin misconfiguration before publish.
- **`docs/add-new-target-playbook.md`** — self-contained guide for adding a new target (built-in or external plugin, project and global mode) designed to be handed to an AI coding agent. Covers research checklist, scaffold workflow, descriptor filling, realistic fixtures, strict-assertion test patterns, registration file wiring, matrix/docs updates, and a verification one-liner. Referenced by the canonical `add-agent-target` skill as the authoritative workflow document.
- **Boot-time guard against ambiguous shared-artifact ownership** — `BUILTIN_TARGETS` initialization now runs `assertSharedArtifactOwnersUnique()` (`src/targets/catalog/shared-artifact-owner.ts`) and throws if two descriptors claim the same or overlapping `sharedArtifacts: { '<prefix>': 'owner' }` entry. Previously the rewriter would silently pick the first match by iteration order, so a misconfigured plugin or future builtin could quietly route global skill writes to the wrong target. The error names both target IDs and both prefixes and suggests changing one role to `'consumer'` or namespacing the prefix. Covered by `tests/unit/targets/catalog/shared-artifact-owner.test.ts` (9 cases including identical-prefix conflicts, prefix-overlap conflicts, owner-vs-consumer non-conflicts, and the live builtin set).
- **Cross-process race coverage for the generate lock** — `tests/integration/generate-process-lock.integration.test.ts` now proves two parallel `node dist/cli.js generate` invocations against the same project serialize via the existing process lock, both exit `0`, produce deterministic output, and release `.agentsmesh/.generate.lock` after the run. Complements the existing unit tests that exercise `acquireProcessLock` directly.
- **End-to-end Copilot dual-mirror coverage** — `tests/unit/targets/copilot/global-layout.test.ts` adds two engine-level assertions that prove Copilot's `mirrorGlobalPath` emits the exact set `.copilot/skills/<name>/`, `.agents/skills/<name>/`, and `.claude/skills/<name>/` in global mode when codex-cli is not active, and skips the `.agents/skills/` mirror when codex-cli is generated alongside (so codex-cli's `'owner'` claim wins).
- **Programmatic API: complete `lint`, `diff`, `check`, and config-loader surface** — every CLI capability is now callable as a typed function. New exports from `agentsmesh` and `agentsmesh/engine`:
  - `loadConfig(projectRoot)` and `loadConfigFromDirectory(configDir)` — load + validate `agentsmesh.yaml` (merging `agentsmesh.local.yaml`) and return `{ config: ValidatedConfig, configDir }`. Throws `ConfigNotFoundError` / `ConfigValidationError` with stable `code` fields.
  - `loadProjectContext(projectRoot, options?)` — loads the same execution context the CLI uses: scoped config, plugin descriptors, `extends`, packs, and local canonical content. The returned object is directly usable with `generate`, `lint`, and `diff`.
  - `lint(opts)` — runs target linters, returns `{ diagnostics, hasErrors }`. Pure: no I/O, no logging.
  - `diff(ctx)` — runs generate internally, returns `{ results, diffs, summary }`. Plus `computeDiff(results)` and `formatDiffSummary(summary)` helpers for callers that already have generate results.
  - `check(opts)` — pure lock-vs-current drift detection backed by the new shared `src/core/check/lock-sync.ts` module. Returns a structured `LockSyncReport` (`inSync`, `hasLock`, `modified`, `added`, `removed`, `extendsModified`, `lockedViolations`). The `agentsmesh check` CLI command was refactored to use the same helper so CLI and Programmatic API can never drift.
  - New types: `ValidatedConfig`, `TargetLayoutScope`, `LintOptions`, `LintResult`, `LintDiagnostic`, `ComputeDiffResult`, `DiffEntry`, `DiffSummary`, `CheckLockSyncOptions`, `LockSyncReport`.
- **Programmatic API runtime coverage** — new `tests/integration/programmatic-api.integration.test.ts` (26 strict assertions) exercises every public function and every error class against real fixture state: shape inventory, `loadConfig` happy/missing/invalid-schema paths, `loadCanonical`, `loadProjectContext` CLI-parity loading, `generate` with exact-paths assertion, `targetFilter` narrowing, `registerTargetDescriptor` plugin wiring through `generate`, plugin `importFrom` end-to-end, `lint` shape, `diff` + `computeDiff` summary parity, `check` for `hasLock=false` / `inSync=true` / modified-drift, immutable catalog inspection, `resolveOutputCollisions`. Replaces the previous shallow `public-export-smoke.integration.test.ts` (which only checked `typeof === 'function'` and used loose `length > 0` assertions).
- **Programmatic API type contract coverage** — `tests/consumer-smoke/src/smoke.ts` extended to import every new symbol (`loadProjectContext`, `loadConfig`, `loadConfigFromDirectory`, `loadCanonical`, `loadCanonicalFiles`, `lint`, `diff`, `check`, `computeDiff`, `formatDiffSummary`, `ProjectContext`, `LoadProjectContextOptions`, `LoadCanonicalOptions`, `ValidatedConfig`, `LintOptions`, `LintResult`, `CheckLockSyncOptions`, `LockSyncReport`, `ComputeDiffResult`, `DiffEntry`, `DiffSummary`) and exercise them with no `unknown` casts (the previous `as unknown as ValidatedConfig` hack is gone now that the type is public). `pnpm consumer-smoke` packs the tarball, installs into a strict-mode TS project, and `tsc --noEmit`s the full surface — catches `TS7016` and signature regressions before publish.
- **Dedicated Programmatic API reference page** at `website/src/content/docs/reference/programmatic-api.mdx` — entrypoint table, the recommended `loadProjectContext` generate pattern, per-function signatures and examples for `loadProjectContext` / `loadConfig` / `loadCanonical` / `generate` / `importFrom` / `lint` / `diff` / `check` / `registerTargetDescriptor` / catalog inspection, full error taxonomy table, canonical types, target-descriptor types, and stability guarantees. Linked from the landing page and sidebar Reference section. README "Programmatic API" section rewritten so the example actually compiles and matches CLI setup for plugins, `extends`, and packs.

### Changed

- **Production-grade build output** — `tsup.config.ts` reworked with a split policy that matches the two artifact families:
  - **CLI binary (`dist/cli.js`)**: minified with `keepNames: true` so stack traces still reference real function/class names. Sourcemap no longer shipped to npm — with `keepNames` the minified stack traces remain debuggable from error text alone, and the 1.6 MB sourcemap was dead weight for the 99% of users who never debug into CLI internals (maintainers reproduce locally with sourcemap on).
  - **Library entries (`dist/{index,engine,canonical,targets}.js`)**: unminified (consumers' bundlers minify their own output — standard convention used by React, Vue, Vitest, tsup itself), sourcemaps shipped (consumers stepping into library code from their own debugger get a usable experience).
  - Explicit `treeshake: true` on both bundle families.
  - Net effect: `dist/cli.js` 643 KB → 325 KB (-49%); compressed npm tarball 1.21 MB → 923 KB (-24%); unpacked install 6.0 MB → 4.75 MB (-21%). CLI cold-start parse time drops correspondingly.
- **Conversion config schema**: inner `commands_to_skills` and `agents_to_skills` objects changed from `.strict()` to `.passthrough()`, allowing plugin target IDs without validation errors. The outer `conversions` object remains strict. Conversion values now accept either `boolean` (both scopes) or `{ project?: boolean, global?: boolean }` for per-scope control.
- **Conversion helpers**: `shouldConvertCommandsToSkills` and `shouldConvertAgentsToSkills` accept optional `defaultEnabled` and `scope` parameters. Per-scope config values are resolved against the active scope, with missing scope keys falling back to builtin defaults.
- **Builtin-targets module**: five lookup functions (`getTargetCapabilities`, `getTargetDetectionPaths`, `getTargetLayout`, `getEffectiveTargetSupportLevel`, `resolveTargetFeatureGenerator`) now fall back to the plugin registry via `getDescriptor()` when no builtin match is found.
- **Registry**: `builtinDescriptors` map is now lazily initialized to avoid circular-dependency crashes between `builtin-targets.ts` and `registry.ts`.
- **JSON Schema**: `schemas/agentsmesh.json` updated — conversion inner objects now use `"additionalProperties": {}` (passthrough) instead of `"additionalProperties": false`.
- **`agentsmesh generate --global` log output** — generated file paths now display with a `~/` prefix (e.g. `✓ updated ~/.claude/settings.json`) so users cannot mistake a home-directory write for a project-local write. Applies to dry-run, check-only, and success output. Project-mode display is unchanged.
- **`writeFileAtomic` safety hardening** — orphaned `.tmp` sidecars are now removed on rename failure. Target paths that already exist as directories throw `FileSystemError` with `errnoCode: 'EISDIR'` instead of leaking the raw rename error. Readable error messages preserved with original errors as `cause`.
- **Remote tar extraction hardening** — `tar.extract` for GitHub tarballs now runs with `strict: true` (promotes warnings to errors) and explicitly rejects `Link` and `SymbolicLink` entries in addition to the existing zip-slip `..` / absolute-path filter. Defense-in-depth against malicious remote packs.
- **Package metadata**: `main` and `types` point at `./dist/index.{js,d.ts}`; root `exports."."` is a full conditional block. `@arethetypeswrong/cli` and `publint` added as devDependencies. New npm scripts: `publint`, `attw`, `consumer-smoke`.
- **README**: new **Programmatic API** section with typed import examples for the root barrel and the three subpath entrypoints (`agentsmesh/engine`, `agentsmesh/canonical`, `agentsmesh/targets`).
- **`--global` commands now throw a scope-aware error when `~/.agentsmesh/agentsmesh.yaml` is missing.** The message points at the exact missing path and suggests `agentsmesh init --global` to create the global canonical root, or dropping `--global` to operate on the current project. Applies uniformly to `generate`, `import`, `lint`, `check`, `diff`, `watch`, and `matrix`. Previously a generic "config not found" error left first-time global users guessing. Covered by `tests/unit/config/scope.test.ts`.
- **`ConfigNotFoundError` constructor accepts an optional `message` override** (`{ cause?, message? }`) so wrappers can supply scope-aware copy without losing the typed error class, `code`, or `path`. Existing callers that pass only `path` (and optional `cause`) are unchanged.

### Removed

- **Native Windows support deferred to a later release.** `package.json` now declares `"os": ["darwin", "linux"]`, the CI matrix dropped `windows-latest`, and the README's Install section calls this out with WSL2 as a workaround. The deferral path and re-enablement checklist are tracked in `docs/roadmap.md` under "Windows support (deferred)". Three POSIX-correctness fixes that landed in this release as defense-in-depth — `installs.yaml` `source` field always written as POSIX (`src/install/source/parse-install-local.ts`), plugin file-URL conversion via `fileURLToPath` instead of `URL.pathname` (`src/plugins/load-plugin.ts`), and `path.join` used in the canonical extend-load test expectations — already pave the way for the eventual re-enablement.

### Fixed

- **Programmatic API parity gaps** — `loadCanonical()` now mirrors CLI canonical loading by merging `extends` and packs when config is available (`loadCanonicalFiles()` remains the local-only helper); public `importFrom()` now resolves registered plugin descriptors as well as built-ins; plugin `buildImportPaths()` hooks now participate in shared import reference normalization; `getTargetCatalog()` returns immutable catalog snapshots instead of the live built-in array; descriptor registration now rejects non-`none` capabilities that do not have a generator or settings sidecar emitter.
- **`TS7016` on root import** — `import { ... } from 'agentsmesh'` previously resolved to `./dist/cli.js`, which was built with `dts: false`. Root exports now point at the typed library barrel, and `attw` + `publint` + consumer-smoke guards prevent regression.
- **Stale coverage exclusion paths in `vitest.config.ts`** — 15 excluded files referenced stale paths after a folder restructure (`src/utils/fs.ts` → `src/utils/filesystem/fs.ts`, `src/config/lock.ts` → `src/config/core/lock.ts`, `src/install/git-pin.ts` → `src/install/source/git-pin.ts`, and others). Paths corrected; one entry for a deleted file (`src/install/local-source.ts`) removed.
- **Canonical `add-agent-target` skill** — restored mangled prose references (`` `../../` `` back to `` `.agentsmesh/` ``); updated stale code touchpoints (`src/config/schema.ts` → `src/config/core/schema.ts`, `src/cli/help.ts` → `src/cli/help-data.ts`, `src/core/matrix/matrix.ts` → `src/core/matrix/data.ts`); added missing registration-file pointers (`target-ids.ts`, `builtin-targets.ts`, `import-maps/index.ts`); named the `agentsmesh target scaffold <id>` scaffold command as the starting step; referenced `docs/add-new-target-playbook.md` for the step-by-step workflow; added `pnpm matrix:verify`, `pnpm publint`, `pnpm attw`, and `pnpm consumer-smoke` to the required verification list.

## 0.5.0 - 2026-04-23

### Added

- **JSON Schema for all config files** — `agentsmesh.yaml`, `agentsmesh.local.yaml`, `.agentsmesh/permissions.yaml`, `.agentsmesh/hooks.yaml`, `.agentsmesh/mcp.json`, and `.agentsmesh/packs/*/pack.yaml` now ship with JSON Schemas derived directly from Zod source schemas. Enables full IDE autocomplete, enum validation, and hover docs in VS Code, JetBrains, and any YAML/JSON Language Server with zero user configuration. Schemas are published to `schemas/` in the npm package and accessible at `https://unpkg.com/agentsmesh/schemas/*.json`. Run `pnpm schemas:generate` to regenerate after schema changes.
- **`$schema` comment in generated config files** — `agentsmesh init` now writes a `# yaml-language-server: $schema=...` comment as the first line of both `agentsmesh.yaml` and `agentsmesh.local.yaml`, activating IDE validation without any manual setup.
- **Global mode** (`--global`, canonical `~/.agentsmesh/`) for **all** built-in targets — Claude Code, Cursor, Copilot, Continue, Junie, Kiro, Gemini CLI, Cline, Codex CLI, Windsurf, Antigravity, and Roo Code. Each target has a `descriptor.global` layout with project→user path rewriting, import/generate alignment, optional `~/.agents/skills/` mirroring when Codex CLI is not a global target, reference/link rewriting, and comprehensive test coverage.
- **Roo Code agents → custom modes**: canonical agents now generate `.roomodes` (project) and `settings/custom_modes.yaml` (global) with a `customModes` YAML structure. Roo Code agents capability upgraded from `—` to `partial`.
- **Copilot global extras**: `~/.copilot/AGENTS.md` is now generated in global mode as a root-instructions compat file.
- **Continue global config**: global mode generates `~/.continue/config.yaml` (aggregating rules as `rules:`, commands as `prompts:`, MCP as `mcpServers:`) and `~/.continue/AGENTS.md`.
- **Copilot global skill mirror**: skills are now mirrored to both `~/.agents/skills/` and `~/.claude/skills/` in global mode.
- **Cline global hooks round-trip**: `agentsmesh import --from cline` now reads hook scripts from `~/Documents/Cline/Hooks/` (global mode) and `.clinerules/hooks/` (project mode). Hook scripts embed a `# agentsmesh-event: <event>` metadata comment for lossless round-trip; the generator also includes this comment going forward.
- `sharedArtifacts` field added to target descriptor — enables collision-free generation when multiple targets share an output path (e.g. `.agents/skills/`).
- Lint hooks wired to all target descriptors.
- Contributor skill **`add-global-mode-target`** for scoped work when extending or validating one target’s global-mode behavior.
- Comprehensive structure validation test coverage for all 12 targets in both project and global modes.
- Shared validation helpers library (`tests/unit/targets/validation-helpers.ts`) with reusable helpers for JSON, Markdown, YAML, frontmatter, and file structure validation.

### Fixed

- **Claude Code output-styles**: generated output-style files no longer carry `agent-` / `command-` filename prefixes — now `{name}.md` as documented.
- **Windsurf**: `src/AGENTS.md` removed from `managedOutputs` (was incorrectly tracked as a managed file).
- **Cline**: `.clinerules/` directory added to `managedOutputs.dirs` for correct stale-artifact cleanup after `generate`.
- **Copilot global instructions**: path-specific instructions now aggregate into `~/.copilot/copilot-instructions.md` in global mode (previously suppressed).
- **Windsurf MCP capability**: both project and global scopes now consistently `partial` (global was incorrectly `native`).
- **Codex CLI detection**: detection paths expanded to include `AGENTS.md`, `AGENTS.override.md`, `.codex/config.toml`, `.codex/agents`, and `.codex/rules`.
- **Link rebaser**: `.agentsmesh/` anchor preserved correctly in generated prose.

### Changed

- **Init scaffold:** example files created by `agentsmesh init` are now prefixed with `_` (`_example.md`, `skills/_example/SKILL.md`). Files and directories with a `_` prefix are excluded from generation, so the starter templates serve as visible reference only and do not produce tool-specific output. `_root.md` remains the sole `_`-prefixed file that is always included in generation.
- **Documentation:** README and website updated to reflect Roo Code agents support, Copilot and Continue global extras, and the new `schemas/` package contents. `generate.mdx` documents global mode path resolution (how `--global` maps to `homedir()` as `projectRoot`).

### Refactored

- Extracted `mirrorSkillsToAgents()` shared helper (`src/targets/catalog/skill-mirror.ts`) — replaces repeated `!activeTargets.includes(‘codex-cli’)` guards inline across 8 target files.
- Consolidated import map builders; removed duplicate validation tests.
- Extracted shared skill-import pipeline; deleted obsolete `skills-helpers` files.
- Improved link rebaser resolution and managed embedding.
- Removed unused `COPILOT_GLOBAL_MCP` / `COPILOT_GLOBAL_CONFIG` constants.

## 0.3.1 - 2026-04-12

### Changed

- Refresh direct and transitive dependencies to patched releases, including guarded `pnpm` overrides for vulnerable `vite`, `picomatch`, and `brace-expansion` ranges pulled in through the toolchain.

### Fixed

- Remove the brittle `npm install -g npm@latest` step from the npm trusted-publishing workflow and run the publish job on Node 24 so release automation uses a bundled npm that already satisfies trusted-publishing requirements.
- Harden `watch` command unit-test wait budgets after the Vitest upgrade so the full suite stays stable under slower CI and coverage runs.

## 0.3.0 - 2026-04-12

### Added

- Add **Kiro** as a supported target with native project-level `AGENTS.md`, `.kiro/steering/*.md`, `.kiro/skills/*/SKILL.md`, `.kiro/hooks/*.kiro.hook`, `.kiro/settings/mcp.json`, and `.kiroignore` import/generate support.

### Changed

- Replace the appended **AgentsMesh Generation Contract** root paragraph with an installed-repo guide: `agentsmesh.yaml` / `agentsmesh.local.yaml`, what lives under `.agentsmesh`, `init` / `import` / `install` / `generate`, and maintenance commands (`diff`, `lint`, `check`, `watch`, `matrix`, `merge`). Prior shipped contract wordings remain import-compatible legacy forms so root instruction upgrades do not duplicate sections.
- `agentsmesh init --yes` now adds the same example canonical files as a normal `init`, but only for categories left empty by import. The starter target set also stays conflict-free by default, leaving `codex-cli` opt-in when projects want Codex output alongside other `AGENTS.md` targets.

### Fixed

- Fix website deployment SEO handling by deriving canonical URLs, sitemap/robots output, and optional `CNAME` generation from one deploy URL source of truth. Internal docs links now stay base-agnostic across GitHub Pages project paths and root custom domains.
- When multiple targets generate `AGENTS.md`, AgentsMesh now prefers the richer Codex output when it is a strict superset instead of failing the whole generate pass on the `codex-cli`/Kiro overlap.

## 0.2.10

### Patch Changes

- Align `agentsmesh init` default `targets` with the shared target catalog (`TARGET_IDS`) so new configs include every supported tool without a duplicate list. Shorten the AgentsMesh sourcing note appended to generated root instructions.

## 0.2.9

### Patch Changes

- Add **Roo Code** as a supported target (`.roo/` rules, commands, skills, MCP, and `.rooignore`).

## 0.2.8

### Patch Changes

- Add Antigravity as a supported target, emit Continue root rules as `.continue/rules/general.md` (while still importing legacy `_root.md`), register built-in targets through target descriptors, and align Continue e2e contracts with the new rule filename.

## 0.2.6

### Patch Changes

- d011602: Add a Starlight documentation site published to GitHub Pages; shorten the npm README and link to the hosted docs for full guides and CLI reference.

## 0.2.5

### Patch Changes

- f7a4afd: Expand the project README, and fix the sample Claude Code PostToolUse hook to use `type: prompt` with a `prompt` field instead of an invalid command-style hook after reads.

## 0.2.4

### Patch Changes

- 98bf8cb: Preserve nested canonical import paths and placeholder metadata; keep nested command picks and Cline workflow exclusions when installing packs; import Cline MCP settings from legacy `.cline/mcp_settings.json` when `cline_mcp_settings.json` is absent; refresh default `.gitignore` patterns for AgentsMesh cache and lock temp files.

## 0.2.3

### Patch Changes

- 8ae253b: Improve Codex CLI rule generation by projecting additional rules to `.codex/instructions/` and linking them from `AGENTS.md` without duplicating the root instructions file.

## 0.2.2

### Patch Changes

- d42b374: Support installing standalone skill repos (bare GitHub/GitLab URLs), use SKILL.md frontmatter name for skill identity, filter repo boilerplate from installed skills, and fix pack skill reference paths in generated output.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.1

### Changed

- npm publish now triggers after GitHub release is created, decoupling version tagging from package publishing

## 0.2.0

### Minor Changes

- bda10c7: Initial public release of AgentsMesh v0.2.0.
  One canonical `.agentsmesh/` source synced to Claude Code, Cursor, GitHub Copilot, Continue, Junie, Gemini CLI, Cline, Codex CLI, and Windsurf. Includes `init`, `generate`, `import`, `diff`, `lint`, `watch`, `check`, `merge`, `matrix`, and `install` CLI commands with full support for rules, commands, agents, skills, MCP servers, hooks, ignore patterns, permissions, local/remote extends, link rebasing, and lock-file-based collaboration.

## [0.1.0] - 2026-03-25

### Added

**CLI commands**

- `init` — Scaffold `agentsmesh.yaml`, `.agentsmesh/rules/_root.md`, and `agentsmesh.local.yaml`; auto-detect existing AI tool configs in the project
- `generate` — Sync canonical `.agentsmesh/` to target tool configs; supports `--targets`, `--dry-run`, `--force`, `--refresh-cache`, `--no-cache`
- `import --from <target>` — Import existing tool configs into canonical form; supports all 9 targets
- `diff --targets` — Show unified diff of what the next `generate` would change
- `lint --targets` — Validate canonical files and target-specific constraints with per-feature diagnostics
- `watch --targets` — Watch `.agentsmesh/` and regenerate on change with 300 ms debounce; self-generated lock file writes do not retrigger the pipeline
- `check` — Verify generated files match the lock file; designed for CI drift detection
- `merge` — Resolve `.agentsmesh/.lock` conflicts after a git merge
- `matrix --targets --verbose` — Show the feature-target compatibility table
- `install` — Install skills, rules, commands, or agents from a local path or remote GitHub/GitLab/git source; supports `--as`, `--sync`, `--dry-run`, `--force`, `--path`, `--target`, `--name`, `--extends`

**Supported targets**

Claude Code, Cursor, GitHub Copilot, Continue, Junie, Gemini CLI, Cline, Codex CLI, Windsurf

**Canonical features**

rules, commands, agents, skills, mcp, hooks, ignore, permissions

**Config**

- `agentsmesh.yaml` — project config with targets, features, and extends
- `agentsmesh.local.yaml` — local-only overrides for targets, features, and personal extends (gitignored)
- `.agentsmesh/` — canonical source directory (source of truth)
- `.agentsmesh/.lock` — generated-state lock file for `check` and `merge`

**Extends**

- Local extends (`local:path` or relative path) — merge shared configs from a relative directory
- Remote extends (`github:org/repo@tag`, `gitlab:group/repo@tag`, `git+ssh://...`) — fetch and cache in `~/.agentsmesh/cache/`

**Link rebasing**

Internal `.agentsmesh/` file references are rewritten to target-relative paths on `generate` and restored to canonical form on `import`, so supporting files and cross-skill links remain correct across all targets

**Collaboration**

- Lock file tracks checksums for all canonical features and extends
- `check` integrates with CI to catch generated file drift
- `merge` recovers from three-way lock file conflicts after `git merge`
