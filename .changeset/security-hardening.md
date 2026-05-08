---
'agentsmesh': minor
---

Security and robustness hardening across MCP write tools, hook script generation, remote fetch, and canonical name validation. Some changes are behaviorally breaking; pre-1.0 minor bump per project policy.

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
