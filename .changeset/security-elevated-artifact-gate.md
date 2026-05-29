---
'agentsmesh': minor
---

Harden install pipeline against third-party supply-chain attacks.

- **Strip elevated artifacts from non-local sources by default.** `hooks.yaml`, `permissions.yaml`, and `mcp.json` are now removed from any pack installed from a `github:`, `gitlab:`, or `git+...` source unless you opt in. These three files control your agent's tool settings (shell hooks, granted permissions, MCP launch specs) and a malicious pack shipping any of them could otherwise execute arbitrary local commands the next time the matching event fires. Opt in per-artifact with `--accept-hooks`, `--accept-permissions`, `--accept-mcp`, or all three with `--accept-elevated`. Local sources remain trusted as before.
- **Skill supporting-file traversal no longer follows symlinks.** A pack containing `skills/foo/keys -> /Users/victim/.ssh` previously pulled external bytes (private keys, etc.) into the canonical skill content. Skill traversal now uses the existing `readDirRecursiveNoSymlinks` helper, mirroring the hardening already applied to install-manifest hashing.
- **Redact credentials from remote-fetch error output.** `oauth2:<token>@`, `x-access-token:<token>@`, and any other userinfo-bearing URLs are now masked (`https://***@host/...`) in console warnings and thrown error messages so GitHub PATs and GitLab tokens never leak into CI logs, terminal scrollback, or log shippers.
- **Gate `git+file://` sources behind `AGENTSMESH_ALLOW_LOCAL_GIT=1`.** On shared/multi-tenant hosts a `git+file:///tmp/world-writable-repo` `extends:` clause could silently consume a repo planted by another user; combined with downstream elevated-artifact emission this was a local priv-esc vector. Set `AGENTSMESH_ALLOW_LOCAL_GIT=1` to enable for closed-network development.
- **Allowlist tar entry types on GitHub tarball extraction.** Previously only `Link` and `SymbolicLink` were rejected (denylist). Now only `File` and `Directory` entries extract; FIFOs, devices, hardlinks, and any future/exotic tar variant are rejected by default.

These changes apply to `agentsmesh install`, `agentsmesh refresh`, and any `extends:` resolution against a non-local source. They are behavior changes for users who were silently inheriting hooks/permissions/mcp from a remote pack — re-run with the matching `--accept-*` flag (or `--accept-elevated`) to preserve previous behavior intentionally.
