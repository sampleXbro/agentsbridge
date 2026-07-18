---
"agentsmesh": minor
---

Continue: raise ignore from partial to native for both project and global scopes — generate and import `.continueignore` and `~/.continue/.continueignore`.

- **Ignore (project, partial → native)**: agentsmesh now generates `.continueignore` at the project root from canonical ignore patterns (gitignore format, one pattern per line). Import reads `.continueignore` back into `.agentsmesh/ignore`. Verified against the official Continue docs: "If you'd like to exclude additional files, you can add them to a `.continueignore` file, which follows the exact same rules as `.gitignore`." (docs.continue.dev/reference/deprecated-codebase)
- **Ignore (global, partial → native)**: agentsmesh now generates `~/.continue/.continueignore` from canonical ignore patterns in global mode. Import reads it back into `.agentsmesh/ignore`. Verified: "Continue also supports a global `.continueignore` file that will be respected for all workspaces, which can be created at `~/.continue/.continueignore`." (docs.continue.dev/reference/deprecated-codebase)
- The `lintIgnore` warning that told users to configure ignore manually is removed — generation handles it natively.
- The global importer now correctly propagates the `scope` parameter to `runDescriptorImport` (was hardcoded to `'project'`), enabling scope-correct path resolution for all descriptor-driven imports.
