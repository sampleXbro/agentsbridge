# Lessons: Windows & POSIX paths

## Rules (apply unconditionally)

1. **Never `split('/')` a filesystem path.** Use `basename(path[, ext])` from `node:path`. On Windows, `path.join` produces `\` separators, so `split('/').pop()` returns the *entire* path and downstream `mkdir` blows up on `C:/...` segments. Audit `split('/').pop()`, `split('/').slice(-N)`, and `endsWith('/x')` against native path fields whenever new path-derived identifiers land. (Evidence: L195, L190)

2. **Pick `node:path` vs `node:path/posix` by path *format*, not host platform.** Any code in `src/core/reference/` or `applyXxxRefs` helpers that participates in the link-rewrite map (key construction OR lookup) MUST use `pathApi(projectRoot)` from `src/core/path-helpers.ts`. Never import `join`/`normalize` from `node:path` directly there. In synthetic-root unit tests (`ROOT = '/proj'`), alias `join`/`normalize` to `posix.join`/`posix.normalize`. (Evidence: L198, L200)

3. **Test helpers that fake `$HOME` must set `USERPROFILE` on win32.** `node:os.homedir()` reads `USERPROFILE` (not `HOME`) on Windows. Centralize the translation in the spawn helper, not at every call site. (Evidence: L5)

4. **Normalize native-path test assertions through `toPosixPath()`.** `fromPath`, `srcPath`, and similar fields are intentionally native (callers pass them to `fs.readFileSync`); rewrite the *assertion*, not the production code. Use `tests/helpers/posix-path.ts` for `.toContain('.codex/...')` / `.includes('...')` checks. (Evidence: L196)

5. **CLI display paths must be `.replaceAll('\\', '/')` before printing.** Tests assert forward slashes unconditionally; native `node:path` separators leak platform differences into user-facing output. (Evidence: L226)

6. **Chokidar must use `usePolling: process.platform === 'win32'` in production, and force polling in *every* watch test on every OS.** Windows tmp dirs under `AppData\Local\Temp\...` miss `ReadDirectoryChangesW` events on freshly-created subdirs; macOS FSEvents + Linux inotify drop events under parallel suite load on just-mkdir'd subtrees. Wrap `runWatch` via `tests/harness/watch.ts` and always pass `{ usePolling: true, interval: 50 }`. (Evidence: L197, L266 also relevant)

7. **Prefer the caller's projectRoot-shaped path over realpath; treat realpath as a tie-breaker.** On Windows runners under `RUNNER~1`, `realpathSync.native` expands to the long form (`runneradmin`), and `toProjectRootRelative(short, long)` yields `..\..\..` chains. In `expandResolvedPaths` and any `[realpath, original]` loop, the caller-shaped variant must win. (Evidence: L203, L202)

8. **Cross-platform repos commit `.gitattributes` with `* text=auto eol=lf` and explicit text categories.** Don't rely on per-runner git config — Windows runners default `core.autocrlf=true`, rewriting fixture `.md`/`.json`/`.yaml` to CRLF on checkout while `writeFileAtomic` emits LF. For tests that stage repo files into a tmpdir, use `writeFileSync(to, readFileSync(from, 'utf-8').replace(/\r\n/g, '\n'))` instead of `copyFileSync`. (Evidence: L220, L201)

9. **URI/scheme detection must not swallow Windows drive letters.** Keep the URI scheme matcher distinct from `[A-Za-z]:[\\/]` drive-letter detection. Plugin/source `isLocalSource` classifiers must accept `D:\foo` alongside POSIX absolutes — `node:path`'s `resolve()` produces drive-letter absolutes on win32. Regression tests cover both `C:` and `ssh://...` in the same file. (Evidence: L135, L246)

10. **Strip Windows absolute path tokens before "no canonical path in output" assertions.** The link rebaser intentionally leaves Windows absolutes untouched (`WINDOWS_ABSOLUTE_PATH` guard), so legitimate `\.agentsmesh\` substrings inside `C:\...\.agentsmesh\rules\typescript.md` trip naive `not.toContain('.agentsmesh\\')` checks. Extend `stripProtectedRegions` (or local assertion helpers) to drop `/[A-Za-z]:[\\/][^\s,<>"'`+`'`'`+`]+/g` first. (Evidence: L204)

11. **Skip-on-Windows is the correct answer for POSIX-only test contracts.** Tests that (a) construct canonical content with absolute paths that turn into `C:\...` on Windows, (b) stub `git` via chmod-755 Node scripts, (c) pass `NODE_OPTIONS=--import=<windows path>`, or (d) assert POSIX mode bits (`statSync(p).mode & 0o111`) must `it.skipIf(process.platform === 'win32')`. For mode bits, query the git index (`git ls-files --stage`) instead — NTFS doesn't surface execute bits. (Evidence: L199, L224, L248)

12. **Walkers across project trees must skip `.agentsmesh`, `.agentsmeshcache`, `node_modules`, `.git` at directory-entry level AND wrap `readdirSync`/`statSync` in try/catch.** Windows TOCTOU between exiting CLI processes and test walkers ENOENTs mid-walk; the cache dir vanishes between readdir and stat. (Evidence: L222)

13. **Bound symlink-based temp-project setups to dot-entries and root files only.** `createTempProjectRoot(homedir())` must never indiscriminately symlink Desktop/Documents/Downloads — `listScopedAgentsFiles` will recurse into them. Symlink only dot-directories (`.claude/`, `.cursor/`, ...) and root-level files. The same scope guard applies to `global` import: never run whole-tree `readDirRecursive(homedir())` for nested rule discovery; restrict to `~/.codex`, `~/.agents/skills`, etc. (Evidence: L228, L170 also relevant)

14. **Cross-platform path fixtures must resolve in the real file tree.** Don't translate POSIX `../SKILL.md` to `..\\SKILL.md` without rechecking the file's actual directory layout — sibling references must exist in both shapes. (Evidence: L134)

15. **`tmpdir` is from `node:os`, not `node:path`.** Stop the copy-paste before it lands. (Evidence: L183)

16. **For inline-backtick path rewrites and any assertion that depends on realpath equivalence, accept multiple equivalent forms.** DOS 8.3 short names (`RUNNER~1` → `runneradmin`) make `expandResolvedPaths` and `toProjectRootRelative` non-deterministic on Windows tmp dirs. Use permissive regexes like `` /`(?:\.{1,2}\/)*\/?docs\/some-doc\.md`/ `` — the contract is "reaches a stable destination," not "always rewrites to project-root-relative." (Evidence: L202)

17. **Tests that need merged stdout+stderr must not hardcode a POSIX shell.** Use `spawnSync(process.execPath, [...args], { encoding: 'utf-8' })` and concatenate `result.stdout + result.stderr`. Never embed `2>&1` or hardcode `/bin/sh` / `/bin/zsh` once Windows is in the CI matrix. (Evidence: L191)

18. **Control-character escapes in regex literals must survive the `Write` JSON transport.** Build via `new RegExp('[<>:"|?*\\u0000-\\u001F]')` so the file stores literal escape sequences, not raw bytes. Verify with `file(1)` after authoring. (Evidence: L192)
