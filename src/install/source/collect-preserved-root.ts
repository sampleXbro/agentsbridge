/**
 * Collect top-level preserved-boilerplate files (README / LICENSE / NOTICE /
 * COPYING / COPYRIGHT and their variants) from an upstream source root, so
 * the pack writer can copy them verbatim into the materialized pack root.
 *
 * Scope: the source-tree root only (no recursion). README files that live
 * inside skill subtrees travel via `listSupportingFiles` already; README at
 * `agents/`/`commands/`/`rules/` roots is intentionally not in scope per the
 * scoped-down plan in `tasks/todo.md` (treated as advisory link warnings).
 *
 * Returned entries are sorted by `relativePath` so the resulting pack's
 * `content_hash` is deterministic regardless of filesystem ordering.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isPreservedBoilerplate } from '../importers/boilerplate-filter.js';

export interface PreservedRootFile {
  /** Filename relative to `contentRoot` (e.g. `"README.md"`, `"LICENSE"`). */
  readonly relativePath: string;
  /** Absolute path on disk; used by the pack writer as the copy source. */
  readonly absolutePath: string;
}

export async function collectPreservedRootFiles(contentRoot: string): Promise<PreservedRootFile[]> {
  const result: PreservedRootFile[] = [];
  try {
    const entries = await readdir(contentRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!isPreservedBoilerplate(entry.name)) continue;
      result.push({
        relativePath: entry.name,
        absolutePath: join(contentRoot, entry.name),
      });
    }
  } catch {
    // Missing / unreadable source root: treat as "no preserved files" rather
    // than crash the install. Discovery would already have surfaced any real
    // I/O problem upstream.
    return [];
  }
  result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return result;
}
