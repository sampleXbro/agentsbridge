/**
 * Normalize a filesystem path string to POSIX-style separators for assertions.
 *
 * Production code returns native paths (with `\\` on Windows) for callers that
 * pass them to `fs.readFileSync`/etc. Test assertions that match against
 * POSIX-style relative substrings (e.g. `.codex/agents/foo.toml`) should
 * normalize the value first so the comparison works on both runners.
 */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}
