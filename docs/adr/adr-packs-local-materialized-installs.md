# ADR: Packs — Local Materialized Installs

## Status

Proposed

## Date

2026-03-22

## Context

The `agentsmesh install <source>` command currently writes a pointer-based `extends` entry to `agentsmesh.yaml`. At generate time, the system re-resolves each extend — fetching from cache or network, importing native formats to canonical, then merging. This design has strengths (always-up-to-date references, compact config) but also pain points:

1. **No local snapshot.** Installed resources are never materialized locally. The user cannot inspect, diff, or version-control what was installed without tracing through cache directories and re-running importers.

2. **Cache ambiguity.** The `~/.agentsmesh/cache/` directory serves dual roles — temporary download staging and persistent offline fallback — making cleanup impossible without risking generate-time failures.

3. **No pack-level metadata.** There is no single place where a user can see "what did I install from where, when, and which resources were included?" The information is spread across `agentsmesh.yaml` extends entries and opaque cache directories.

4. **Network dependency at generate time.** If the cache is missing and the network is down, generation fails for remote extends. This makes CI/CD and offline workflows fragile.

5. **Incremental install friction.** Adding resources from the same repo later requires understanding how extends entries merge (source matching, pick union logic), which is not obvious.

## Decision

Introduce **packs** — self-contained canonical resource snapshots materialized under `.agentsmesh/packs/{name}/`.

### Core design choices

**1. Packs store canonical format, not native.**
When a user installs from a repo with native agent config (e.g., `.cursor/rules/`), the existing importer pipeline converts it to canonical format during install. The pack stores only the canonical result. This means generate never needs to re-import — it loads the pack the same way it loads local `.agentsmesh/` resources.

**2. Packs are filesystem-discovered.**
No entries in `agentsmesh.yaml`. The generate pipeline scans `.agentsmesh/packs/*/pack.yaml` and loads each valid pack. This means:
- Install: create a directory. Uninstall: delete a directory. No config file edits.
- No risk of config-vs-filesystem drift.
- Users can manage packs with standard file operations (copy, move, delete, git).

**3. Merge order: extends → packs → local.**
Later sources override earlier ones. Packs override extends because they represent a more deliberate, local action. Local hand-authored `.agentsmesh/` resources always win.

**4. Cache becomes truly ephemeral for pack installs.**
After successful materialization, the specific cache entry is deleted. Extends (legacy `--extends` flag) retain existing cache behavior for backward compatibility.

**5. Incremental install is additive.**
When installing from a source that already has a pack (matched by `source` field in `pack.yaml`), new resources are added to the existing pack. Features and picks are union-merged. The pack's `updated_at` and `content_hash` are refreshed.

**6. Legacy extends preserved.**
The `--extends` flag on `agentsmesh install` preserves the current pointer-based behavior. Existing extends entries in `agentsmesh.yaml` continue to work unchanged.

### Alternatives considered

**A. YAML-referenced packs.** Each pack would have an entry in `agentsmesh.yaml` under a `packs:` key. Rejected because:
- Adds config management complexity (must keep yaml and filesystem in sync).
- Defeats the simplicity goal — the whole point is "delete a folder to uninstall."
- Feature filtering and pick are already stored in `pack.yaml` metadata.

**B. Replace extends entirely.** All remote references would be materialized as packs. Rejected because:
- Breaking change for existing users.
- Some workflows genuinely benefit from always-up-to-date remote references.
- The two models serve different use cases and can coexist cleanly.

**C. Store native format in packs.** Packs would store the original native format and re-import at generate time. Rejected because:
- Defeats the "no network, no re-import" benefit.
- Duplicates work already done by the importer pipeline.
- Canonical format is the hub of the architecture — storing anything else in `.agentsmesh/` violates the source-of-truth contract.

## Consequences

### Positive

- Users get inspectable, version-controllable local snapshots of installed resources.
- `agentsmesh generate` works fully offline for pack-based installs.
- Install/uninstall is simple filesystem operations — no config editing required.
- Incremental install is natural (add features to existing pack).
- Cache cleanup prevents unbounded disk growth from old installs.

### Negative

- Disk usage increases — canonical resources are duplicated in pack directories.
- Two installation mechanisms (packs + extends) may confuse new users.
- Pack resources are frozen at install time — no automatic updates from upstream. Users must re-install to get changes.

### Neutral

- Lock file gains a `packs` key for tracking pack checksums.
- Watch mode must handle `.agentsmesh/packs/` changes (should work automatically since watcher already observes `.agentsmesh/`).
- The `loadCanonicalFiles()` function appends `.agentsmesh/` internally, so the pack loader calls individual parsers directly — a minor architectural note but not a problem.

## Implementation

See `docs/superpowers/specs/2026-03-22-packs-design.md` for the full technical specification.
