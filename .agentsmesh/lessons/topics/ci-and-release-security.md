# Lessons: CI workflows & release security

## Rules (apply unconditionally)

1. **Never interpolate `${{ ... }}` directly into `run:` script bodies for any expression carrying user-influenceable data (CWE-78).** Flow inputs/outputs through `env:` so they become shell variables, then validate shape (e.g. `case "$VERSION" in [!0-9]*|*[!a-zA-Z0-9.+-]*|"") exit 1 ;; esac`) before use. Applies to `inputs.*`, `steps.*.outputs.*`, and `needs.*.outputs.*` that transitively trace to a workflow input. (Evidence: L236)

2. **Dependent jobs that must run when an upstream is conditionally skipped need an explicit status-function override.** Use `if: !cancelled() && (needs.<upstream>.result == 'success' && <cond> || <skip-allowed-cond>)`. Prefer `!cancelled()` over `always()`. The default implicit `success()` on `if:` short-circuits whenever the upstream was skipped. (Evidence: L230)

3. **Never embed tokens in git remote URLs.** Use `actions/checkout@v4` with `repository:` + `token:` so the credential helper handles auth per-process. Token-in-URL leaks into `.git/config`, `ps`/`/proc/$pid/cmdline`, and uploaded workspace artifacts; GitHub Actions log redaction does NOT cover these surfaces. (Evidence: L238)

4. **Pin every tool that produces release artifacts to at least major.minor; never `latest` in a release pipeline.** Applies to `setup-bun` (`bun-version: "1.2"`), Docker image tags, `npm install` in CI, and any other tool acquisition step in release builds. Reserve `latest` for dev-only iteration. (Evidence: L244)

5. **Checksum verification in curl|sh installers must fail closed (CWE-345).** Both "expected hash absent/empty" and "no checksum tool available" branches must `error` (exit non-zero), never `warn` and continue. The user installing a checksum tool is the right trade-off. (Evidence: L240)

6. **Validate env-controlled paths against a strict allowlist before they cross into shell-parsed files (CWE-77).** Any value flowing from env into a file that is later parsed by a shell (rc files, sourced configs) is shell-equivalent input. Reject anything outside `[a-zA-Z0-9./_~\ -]` for installer paths. Threat model is wrapping processes (Docker entrypoints, Makefiles, parent installers), not the user. (Evidence: L242)

7. **Use `awk` field-equality, not `grep` substring, to look up values keyed by exact filename in checksum-style manifests.** `grep "$TARGET" SHA256SUMS | awk '{print $1}'` matches `agentsmesh-darwin-arm64.exe` and `$TARGET.sig` lines too; use `awk -v t="$TARGET" '$2==t {print $1}'`. Same rule for any `<token>  <filename>` manifest. (Evidence: L234)

8. **Installer scripts editing shell-rc files MUST branch the written line by shell, not just the file path.** Key both the rc-file path AND the line content off `$SHELL`: fish needs `fish_add_path -gP "$BIN_DIR"` (or `set -gx PATH "$BIN_DIR" $PATH`); bash/zsh use `export PATH=...`. Also `mkdir -p "$(dirname "$config")"` before `>>` because parent dirs (e.g. `~/.config/fish/`) may not exist. (Evidence: L232)

9. **For npm trusted publishing, choose a GitHub-hosted Node version whose bundled npm already satisfies current docs; do not self-upgrade npm in CI.** `npm install -g npm@latest` fails on `ubuntu-latest` with arborist dependency tree breakage before the publish step runs. Add an explicit npm install only when a specific known-good version is needed AND the runner cannot supply it directly. (Evidence: L78)

10. **Post-publish `git tag` steps must be idempotent.** `changeset publish` already creates a local `v<version>` tag for single-package repos regardless of the `commit:` flag. The post-publish step shape: `git rev-parse --verify --quiet "$TAG" >/dev/null || git tag "$TAG"; git push origin "$TAG"`. (Evidence: L250)

11. **`.gitattributes` with `* text=auto eol=lf` (plus explicit categories for `*.md`, `*.json`, `*.yaml`) is mandatory in any cross-platform repo whose tests stage fixtures into temp dirs and assert byte-stable generated artifacts.** Windows runners default to `core.autocrlf=true`; relying on per-runner git config is not a contract. Fix EOL at the repo boundary via attributes, not at every consumer site. (Evidence: L220)

12. **CI workflows must run `pnpm build` before any job invoking `pnpm test` or `pnpm test:coverage` when the test config includes integration tests that exec `dist/cli.js`.** Only `pnpm test:e2e` self-builds; the others do not. Fresh CI clones have no prior `dist/`. (Evidence: L187)

13. **Tests/integration steps must never hardcode `/bin/sh` or `/bin/zsh` once Windows is in the CI matrix; never use shell-based `2>&1` redirection in test runners.** Use `spawnSync(process.execPath, [...args])` and concatenate `result.stdout + result.stderr`. On Linux `ubuntu-latest`, `/bin/zsh` does not exist; on Windows neither does `/bin/sh`. (Evidence: L80, L191)

14. **Tests that stub `git` via a `chmod 755` Node script or pass `NODE_OPTIONS=--import=<unix path>` must be `it.skipIf(process.platform === 'win32')`.** GitHub Actions Windows runners block git network ops and do not honor these stub strategies. Cover the behavior on Linux/macOS. (Evidence: L199)

15. **Plugin/source classifiers distinguishing "local file" from "npm specifier" must accept Windows drive-letter absolutes (`/^[A-Za-z]:[/\\]/`) alongside POSIX `/...`, `./...`, `../...`, and `file:`.** `node:path.resolve()` on win32 produces `D:\foo`; missing this routes legitimate absolute paths into `resolveNpmSpecifier` and `import()` fails. (Evidence: L246)

16. **Test assertions that a tracked file ships executable must query the git index (`git ls-files --stage <path>` and match `/^100755 /`), not `statSync(...).mode & 0o111`.** NTFS on Windows runners does not surface POSIX execute bits; the git-index mode is what `gh release create` carries into the tarball. (Evidence: L248)
