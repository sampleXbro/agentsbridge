/**
 * Lint-gate helper: detect hardcoded target-id string literals.
 *
 * Target ids (e.g. `'gemini-cli'`) must not be branched on outside a target's
 * own `src/targets/<id>/` directory and the catalog — shared/core/install code
 * reads behavior from descriptors instead. This scanner powers the lint test
 * that keeps the regression (arch §3.1) from returning.
 *
 * Matches single- or double-quoted literals only, so target ids appearing in
 * prose comments (which the codebase fences with backticks) are not flagged.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Target ids that appear as a single- or double-quoted literal in `source`. */
export function findTargetIdLiterals(source: string, targetIds: readonly string[]): string[] {
  const found = new Set<string>();
  for (const id of targetIds) {
    const re = new RegExp(`['"]${escapeRegExp(id)}['"]`);
    if (re.test(source)) found.add(id);
  }
  return [...found].sort();
}

/** All non-test `*.ts` files under `dir`, recursively. */
export function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Map of file path → offending target-id literals, for files that have any. */
export function scanDirForTargetIdLiterals(
  dir: string,
  targetIds: readonly string[],
): Record<string, string[]> {
  const offenders: Record<string, string[]> = {};
  for (const file of listSourceFiles(dir)) {
    const hits = findTargetIdLiterals(readFileSync(file, 'utf8'), targetIds);
    if (hits.length > 0) offenders[file] = hits;
  }
  return offenders;
}
