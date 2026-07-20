import type { Fingerprint, LedgerCell } from './ledger-types.js';
import { LEVEL_RANK } from './ledger-types.js';

/**
 * Returns true when any of the three fingerprint arrays is non-empty.
 * An empty fingerprint signals extension-only conformance checking — no
 * structural key/frontmatter/pointer validation is performed by checkConformance.
 */
export function hasNonEmptyFingerprint(fp: Fingerprint): boolean {
  return fp.topLevelKeys.length > 0 || fp.requiredFrontmatter.length > 0 || fp.keyChecks.length > 0;
}

/**
 * Merge an existing ledger cell with a freshly-built cell from the current descriptor.
 *
 * Preservation rules:
 * - For confirmed/rejected cells: keep the existing `maxAchievable` (it reflects
 *   researched evidence, which supersedes the descriptor level).
 * - For unverified cells: take the higher of the two levels (LEVEL_RANK max),
 *   so a descriptor raise is reflected without destroying manually-set ceilings.
 * - Fingerprint: preserve the existing fingerprint when ANY of its three arrays
 *   is non-empty; use the new cell's fingerprint only when the existing one is
 *   fully blank (all three arrays empty).
 * - Provenance (source, verifiedAt, verdict, rejectionReason): always comes
 *   from the existing cell.
 * - Path/ext/format: use the new cell's values when present; fall back to existing.
 */
export function mergeCell(existing: LedgerCell, newCell: LedgerCell): LedgerCell {
  const maxAchievable =
    existing.verdict === 'confirmed' || existing.verdict === 'rejected'
      ? existing.maxAchievable
      : LEVEL_RANK[existing.maxAchievable] >= LEVEL_RANK[newCell.maxAchievable]
        ? existing.maxAchievable
        : newCell.maxAchievable;

  const fingerprint = hasNonEmptyFingerprint(existing.fingerprint)
    ? existing.fingerprint
    : newCell.fingerprint;

  const path = newCell.path || existing.path;
  const ext = newCell.ext || existing.ext;
  const format = newCell.path ? newCell.format : existing.format;

  return {
    ...newCell,
    maxAchievable,
    path,
    ext,
    format,
    fingerprint,
    source: existing.source,
    verifiedAt: existing.verifiedAt,
    verdict: existing.verdict,
    rejectionReason: existing.rejectionReason,
  };
}
