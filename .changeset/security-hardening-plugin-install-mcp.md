---
'agentsmesh': patch
---

fix(security): plug input/path/proto-pollution holes in plugin, install, MCP, and config

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
