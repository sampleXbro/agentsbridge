---
'agentsmesh': minor
---

Security hardening and silent-data-loss fixes across the install, import, and generate pipelines, plus a tightened lessons skill.

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
