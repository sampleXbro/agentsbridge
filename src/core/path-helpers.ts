import { basename, dirname } from 'node:path';
import { readdirSync } from 'node:fs';
import { posix, win32 } from 'node:path';

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;
const TRAILING_PUNCTUATION = /[.!?:;]+$/;

export { WINDOWS_ABSOLUTE_PATH };

export function pathApi(projectRoot: string): typeof posix {
  return projectRoot.includes('\\') || WINDOWS_ABSOLUTE_PATH.test(projectRoot) ? win32 : posix;
}

export function normalizeSeparators(token: string): string {
  return token.replace(/\\/g, '/');
}

export function normalizeForProject(projectRoot: string, filePath: string): string {
  const api = pathApi(projectRoot);
  const normalized = api.normalize(
    api === win32 ? filePath.replace(/\//g, '\\') : normalizeSeparators(filePath),
  );
  return normalized.endsWith(api.sep) && normalized.length > 1
    ? normalized.slice(0, -1)
    : normalized;
}

export function isAbsoluteForProject(projectRoot: string, filePath: string): boolean {
  return pathApi(projectRoot).isAbsolute(filePath) || WINDOWS_ABSOLUTE_PATH.test(filePath);
}

export function stripTrailingPunctuation(token: string): { candidate: string; suffix: string } {
  let candidate = token;
  let suffix = '';
  while (TRAILING_PUNCTUATION.test(candidate)) {
    suffix = candidate.at(-1)! + suffix;
    candidate = candidate.slice(0, -1);
  }
  return { candidate, suffix };
}

export function rootFallbackPath(token: string, projectRoot: string): string | null {
  const api = pathApi(projectRoot);
  const stripped = token.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  return stripped && stripped !== token
    ? normalizeForProject(projectRoot, api.join(projectRoot, stripped))
    : null;
}

/**
 * Strict-case `existsSync`. Returns true only when the file exists AND its
 * on-disk basename matches the requested basename exactly. Defends against
 * macOS / Windows case-insensitive filesystems silently resolving
 * `SPEC.md` to `spec.md`, which the link rebaser would then treat as a real
 * link target and emit a canonical-relative path in generated artifacts.
 *
 * Implementation: list the parent dir and check whether the basename
 * appears verbatim. `realpathSync` won't help — macOS APFS preserves case
 * but resolves case-insensitively, so `realpathSync('/x/SPEC.md')` returns
 * `/x/SPEC.md` even when the actual file is `/x/spec.md`. `readdirSync`
 * reports the on-disk casing, and a JS string comparison is always
 * case-sensitive regardless of FS, giving consistent behavior on Linux,
 * macOS, and Windows.
 */
export function existsWithExactCase(absolutePath: string): boolean {
  try {
    return readdirSync(dirname(absolutePath)).includes(basename(absolutePath));
  } catch {
    return false;
  }
}
