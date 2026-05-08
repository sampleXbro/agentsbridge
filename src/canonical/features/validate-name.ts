/**
 * Canonical name validation for parsed agents/commands/rules/skills.
 *
 * Names flow into target generators that interpolate them directly into
 * output paths (e.g., `${CLAUDE_AGENTS_DIR}/${agent.name}.md`). Filesystem
 * entry names cannot contain path separators, so `basename`-derived names
 * are traversal-safe; what they CAN do is collide with Windows reserved
 * device names (CON, AUX, NUL...) or contain control chars that produce
 * opaque `EINVAL` failures at write time on win32 hosts. Surface those
 * failures here at parse time with an actionable error.
 */
import { findWindowsPathIssues } from '../../utils/filesystem/windows-path-safety.js';

export class CanonicalNameError extends Error {
  readonly feature: string;
  readonly name: string;
  constructor(feature: string, name: string, message: string) {
    super(message);
    this.feature = feature;
    this.name = name;
  }
}

/**
 * Throws if `name` is Windows-unsafe. Use after extracting the slug from a
 * canonical filename via `basename(path, '.md')`.
 */
export function assertCanonicalName(feature: string, name: string): void {
  const issues = findWindowsPathIssues(name);
  if (issues.length === 0) return;
  const reasons = issues.map((i) => `${i.segment} (${i.reason})`).join(', ');
  throw new CanonicalNameError(
    feature,
    name,
    `canonical ${feature} name "${name}" is not portable to Windows: ${reasons}. Rename the file.`,
  );
}

/**
 * Throws if any two paths in `paths` would collapse to the same `basename`
 * after the parser strips the extension. Catches the silent last-write-wins
 * collision pattern when nested files (e.g., `agents/sub/foo.md` and
 * `agents/foo.md`) ride through the same generator.
 *
 * Handles both POSIX and Windows separators since `readDirRecursive` returns
 * native paths — splitting on `/` alone misses `\\` on win32 runners and
 * lets the collision through.
 */
export function assertNoBasenameCollisions(
  feature: string,
  paths: readonly string[],
  stripExt: string,
): void {
  const seen = new Map<string, string>();
  for (const p of paths) {
    const fwdIdx = p.lastIndexOf('/');
    const bckIdx = p.lastIndexOf('\\');
    const idx = Math.max(fwdIdx, bckIdx);
    const base = idx === -1 ? p : p.slice(idx + 1);
    const slug = base.endsWith(stripExt) ? base.slice(0, -stripExt.length) : base;
    const prior = seen.get(slug);
    if (prior !== undefined && prior !== p) {
      throw new CanonicalNameError(
        feature,
        slug,
        `canonical ${feature} files collide on slug "${slug}": ${prior} vs ${p}. Rename one.`,
      );
    }
    seen.set(slug, p);
  }
}
