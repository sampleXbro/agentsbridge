---
'agentsmesh': patch
---

Security hardening and correctness fixes across install, generate, reference rewriting, plugin loading, and caching subsystems.

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
