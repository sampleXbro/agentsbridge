import { relative, resolve } from 'node:path';

/**
 * Normalize a recall `--file` path to the project-relative, forward-slash form
 * that lesson `file_glob` patterns are authored against.
 *
 * Recall callers routinely pass shapes a project-relative glob will NOT match:
 * an absolute path (the agent harness often has only that), a `./`-prefixed
 * path, or a Windows backslash path. Without normalization picomatch silently
 * returns no match, so mandatory recall yields zero lessons — a false negative
 * on the most-used recall input. Globs are always project-relative, so the
 * correct, lossless fix is to relativize the input against the project root.
 *
 * A path outside the project root is returned as a `../`-prefixed relative path
 * (still forward-slashed); project globs legitimately will not match it.
 */
export function normalizeRecallFile(file: string, projectRoot: string): string {
  const forward = file.replaceAll('\\', '/');
  const absolute = resolve(projectRoot, forward);
  const rel = relative(projectRoot, absolute).replaceAll('\\', '/');
  // `relative` returns '' only when the path IS the project root — not a file;
  // fall back to the forward-slashed input rather than emitting an empty path.
  return rel === '' ? forward : rel;
}
