/**
 * Canonical ignore <-> Zed `file_scan_exclusions` + `private_files`.
 *
 * Both keys are real exclusion surfaces: `crates/agent/src/tools/read_file_tool.rs`
 * (and `grep_tool` / `list_directory_tool`) refuse a path matching either, and both
 * are fields of `WorktreeSettingsContent`, flattened into `ProjectSettingsContent`,
 * so `.zed/settings.json` honours them as well as `~/.config/zed/settings.json`.
 *
 * The two keys merge differently (crates/settings_content/src/project.rs):
 *   - `file_scan_exclusions: Option<SplicingVec>` — a written array REPLACES the
 *     inherited layer unless it contains `"..."`, which expands to it. Every emit
 *     therefore ends with `"..."` so Zed's own default exclusions survive.
 *   - `private_files: Option<ExtendingVec<String>>` — `merge_from` appends, so a
 *     bare array adds to the defaults. `"..."` must NOT be written here; it would
 *     be taken as a literal glob.
 *
 * Both keys are ADDITIVE in both directions. A glob carries no marker saying who
 * wrote it, and `file_scan_exclusions` also drives the human's file finder,
 * project search and file tree — so agentsmesh contributes its canonical globs
 * and never removes an entry it cannot prove it authored. Deleting one would
 * expose a path the user chose to hide; leaving a stale one only keeps a file
 * hidden, which is the fail-safe direction. Revoking an exclusion therefore
 * takes an edit on both sides (see the target README notes).
 */

/** SplicingVec marker that re-expands the layer being overridden. */
export const ZED_SPLICE_REST = '...';

export const ZED_FILE_SCAN_EXCLUSIONS_KEY = 'file_scan_exclusions';
export const ZED_PRIVATE_FILES_KEY = 'private_files';

export interface ZedIgnoreSettings {
  readonly file_scan_exclusions: string[];
  readonly private_files: string[];
}

/** Blank lines, comments and re-inclusions have no Zed glob form. */
function isUnrepresentable(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!');
}

/**
 * gitignore line -> Zed glob. A slash-free pattern matches at any depth, so it
 * gains a depth-independent `**` prefix; anything else is already root-anchored in gitignore and
 * stays as written.
 */
export function ignoreToZedGlob(line: string): string | null {
  if (isUnrepresentable(line)) return null;
  const body = line.trim().replace(/\/+$/, '');
  if (body === '') return null;
  if (body.startsWith('/')) {
    const anchored = body.replace(/^\/+/, '');
    return anchored === '' ? null : anchored;
  }
  return body.includes('/') ? body : `**/${body}`;
}

/** Zed glob -> gitignore line. Inverse of `ignoreToZedGlob`. */
export function zedGlobToIgnore(glob: string): string | null {
  const body = glob.trim();
  if (body === '' || body === ZED_SPLICE_REST) return null;
  if (body.startsWith('**/')) {
    const rest = body.slice(3);
    if (rest === '') return null;
    return rest.includes('/') ? `/${body}` : rest;
  }
  return `/${body}`;
}

function toGlobs(ignore: readonly string[]): string[] {
  const globs: string[] = [];
  for (const line of ignore) {
    const glob = ignoreToZedGlob(line);
    if (glob !== null && !globs.includes(glob)) globs.push(glob);
  }
  return globs;
}

/**
 * The two keys for the current canonical ignore list, empty when canonical has
 * no representable line — agentsmesh must not create a key it has no content for.
 */
export function buildZedIgnoreSettings(ignore: readonly string[]): ZedIgnoreSettings {
  const globs = toGlobs(ignore);
  if (globs.length === 0) return { file_scan_exclusions: [], private_files: [] };
  return { file_scan_exclusions: [...globs, ZED_SPLICE_REST], private_files: globs };
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((entry) => typeof entry === 'string') ? [...(value as string[])] : null;
}

/**
 * Add the canonical globs to whatever the key already holds.
 *
 * @param existing - The value in `settings.json`, any shape
 * @param desired - The emitted array, splice marker included when it applies
 * @returns The merged array, or `null` when the key must be left untouched
 */
export function mergeZedIgnoreList(existing: unknown, desired: readonly string[]): string[] | null {
  const incoming = desired.filter((glob) => glob !== ZED_SPLICE_REST);
  if (incoming.length === 0) return null;

  const base = stringArray(existing);
  const merged = (base ?? []).filter((glob) => glob !== ZED_SPLICE_REST);
  for (const glob of incoming) {
    if (!merged.includes(glob)) merged.push(glob);
  }
  // A bare user array replaced Zed's defaults on purpose; only re-splice when
  // the key is new or already carried the marker.
  const splices = base === null || base.includes(ZED_SPLICE_REST);
  if (desired.includes(ZED_SPLICE_REST) && splices) merged.push(ZED_SPLICE_REST);
  return merged;
}

/** Globs Zed currently excludes, unioned across both keys in first-seen order. */
export function parseZedIgnoreGlobs(settings: Record<string, unknown>): string[] {
  const globs: string[] = [];
  for (const key of [ZED_FILE_SCAN_EXCLUSIONS_KEY, ZED_PRIVATE_FILES_KEY]) {
    for (const glob of stringArray(settings[key]) ?? []) {
      const trimmed = glob.trim();
      if (trimmed === '' || trimmed === ZED_SPLICE_REST) continue;
      if (!globs.includes(trimmed)) globs.push(trimmed);
    }
  }
  return globs;
}

/** Canonical lines with no Zed glob form other than comments and blanks. */
export function unrepresentableIgnoreLines(ignore: readonly string[]): string[] {
  return ignore.filter((line) => line.trim().startsWith('!'));
}

/**
 * Add imported Zed globs to `.agentsmesh/ignore`, keeping every existing line.
 *
 * Matching is by GLOB, not by line text, so a canonical `node_modules/` is
 * recognised in an imported depth-independent glob and survives verbatim instead
 * of churning to `node_modules`. Nothing is removed: `settings.json` is the
 * user's editor config and is routinely only partly populated, while
 * `.agentsmesh/ignore` is read by every target — treating Zed's silence as a
 * deletion strips `.env.local` or `secrets/` from claude-code, cursor and the rest.
 */
export function mergeCanonicalIgnore(
  existing: string | null,
  importedGlobs: readonly string[],
): string {
  const imported = importedGlobs.filter((glob) => glob.trim() !== ZED_SPLICE_REST);
  if (existing === null || existing.trim() === '') {
    return imported
      .map((glob) => zedGlobToIgnore(glob))
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  const endsWithNewline = existing.endsWith('\n');
  const lines = existing.replace(/\n+$/, '').split(/\r?\n/);
  const covered = new Set(
    lines.map((line) => ignoreToZedGlob(line)).filter((glob): glob is string => glob !== null),
  );

  for (const glob of imported) {
    if (covered.has(glob)) continue;
    const line = zedGlobToIgnore(glob);
    if (line === null) continue;
    covered.add(glob);
    lines.push(line);
  }

  return lines.join('\n') + (endsWithNewline ? '\n' : '');
}
