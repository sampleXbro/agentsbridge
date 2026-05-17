/**
 * Build the `UninstallData` payload returned by `runUninstall`.
 *
 * Two flavors:
 *   - `previewEntries` — for `--dry-run`; reports what *would* happen.
 *     `manifest_entry_removed` and `extends_entry_removed` are always false
 *     because nothing was written.
 *   - `appliedEntries` — post-apply; reports what actually landed, using
 *     each `AppliedRemoval` returned by `applyUninstall`.
 *
 * Forward-slash `pack_path` per the project CLI display rule (paths shown
 * to users must normalize separators before printing).
 */

import { join, relative } from 'node:path';
import type { AppliedRemoval } from './apply-uninstall.js';
import type { RemovalDecision } from './uninstall-decisions.js';
import type { UninstallRemovedEntry } from '../../cli/command-result.js';

function toForwardSlashRel(rootBase: string, abs: string): string {
  return relative(rootBase, abs).replaceAll('\\', '/');
}

export function buildSkipped(
  skipped: readonly string[],
): Array<{ name: string; reason: string }> {
  return skipped.map((name) => ({ name, reason: 'not found in installs.yaml' }));
}

export function previewEntries(
  decisions: readonly RemovalDecision[],
  rootBase: string,
  packsDir: string,
): UninstallRemovedEntry[] {
  return decisions.map((d) => ({
    name: d.plan.name,
    pack_path: toForwardSlashRel(rootBase, join(packsDir, d.plan.name)),
    manifest_entry_removed: false,
    extends_entry_removed: false,
    generated_files_removed: 0,
    modified_files_kept: d.modifications.map((m) => ({
      relativePath: m.relativePath,
      status: m.status,
    })),
    legacy_migrated: d.legacyMigrated,
  }));
}

export function appliedEntry(
  decision: RemovalDecision,
  applied: AppliedRemoval,
  rootBase: string,
  packsDir: string,
): UninstallRemovedEntry {
  return {
    name: applied.name,
    pack_path: toForwardSlashRel(rootBase, join(packsDir, decision.plan.name)),
    manifest_entry_removed: applied.manifestEntryRemoved,
    extends_entry_removed: applied.extendsEntryRemoved,
    generated_files_removed: 0,
    modified_files_kept:
      decision.action === 'keep-modified'
        ? decision.modifications.map((m) => ({ relativePath: m.relativePath, status: m.status }))
        : [],
    legacy_migrated: decision.legacyMigrated,
  };
}
