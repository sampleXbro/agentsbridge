---
'agentsmesh': minor
---

feat(refresh): add `agentsmesh refresh` to re-fetch and re-apply installed packs

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
