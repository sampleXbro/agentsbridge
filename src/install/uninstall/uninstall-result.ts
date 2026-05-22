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

export function buildSkipped(skipped: readonly string[]): Array<{ name: string; reason: string }> {
  return skipped.map((name) => ({ name, reason: 'not found in installs.yaml' }));
}

function packPathFor(decision: RemovalDecision, rootBase: string, packsDir: string): string | null {
  // Extends-only installs never materialized a pack dir on disk; reporting a
  // synthesized path would be misleading in `--dry-run --json` output.
  if (decision.plan.manifestEntry === null) return null;
  return toForwardSlashRel(rootBase, join(packsDir, decision.plan.name));
}

export function previewEntries(
  decisions: readonly RemovalDecision[],
  rootBase: string,
  packsDir: string,
): UninstallRemovedEntry[] {
  return decisions.map((d) => ({
    name: d.plan.name,
    pack_path: packPathFor(d, rootBase, packsDir),
    manifest_entry_removed: false,
    extends_entry_removed: false,
    generated_files_removed: 0,
    modified_files_kept: d.modifications.map((m) => ({
      relativePath: m.relativePath,
      status: m.status,
    })),
    legacy_migrated: d.legacyMigrated,
    // Preview mirrors the live `partial` semantics: `--keep-pack` and
    // `[k]eep-modified` planned outcomes leave bytes on disk, which the
    // applied flow would also flag as partial.
    partial: d.action === 'keep-modified' || d.plan.packDir === null,
  }));
}

export function appliedEntry(
  decision: RemovalDecision,
  applied: AppliedRemoval,
  rootBase: string,
  packsDir: string,
): UninstallRemovedEntry {
  // When the pack was preserved on disk (either the prompt's `[k]eep-modified`
  // branch OR `--keep-pack` short-circuit), the JSON record names the
  // surviving modifications so callers can see *why* the pack was kept.
  const packKept = decision.action === 'keep-modified' || !applied.packDirRemoved;
  return {
    name: applied.name,
    pack_path: packPathFor(decision, rootBase, packsDir),
    manifest_entry_removed: applied.manifestEntryRemoved,
    extends_entry_removed: applied.extendsEntryRemoved,
    generated_files_removed: 0,
    modified_files_kept: packKept
      ? decision.modifications.map((m) => ({ relativePath: m.relativePath, status: m.status }))
      : [],
    legacy_migrated: decision.legacyMigrated,
    partial: applied.partial,
  };
}
