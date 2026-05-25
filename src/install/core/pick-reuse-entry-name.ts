/**
 * Decide which existing install entry's name should be reused when the user
 * re-installs the same source under a different URL spelling. Compares the
 * existing entry's scope (target / as / features) against the incoming
 * install scope and returns the entry name when they match exactly.
 *
 * Returns `null` when no candidate exists or scopes diverge — the caller
 * then falls through to standard feature-variant naming.
 */

import type { InstallManifestEntry } from './install-manifest.js';
import { findExistingInstallName } from './install-name.js';
import type { ParsedInstallSource } from '../source/parse-install-source.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';

/**
 * Returns true when `a` and `b` describe the same feature set, regardless of
 * order. Avoids the O(n²) re-sort inside `.every()` of earlier ad-hoc copies.
 */
export function sameFeatureSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

export interface PickReuseEntryNameArgs {
  readonly manifest: readonly InstallManifestEntry[];
  readonly parsed: ParsedInstallSource;
  readonly entryFeatures: readonly string[];
  readonly yamlTarget: string | undefined;
  readonly explicitAs: ManualInstallAs | undefined;
}

export function pickReuseEntryName(args: PickReuseEntryNameArgs): string | null {
  const { manifest, parsed, entryFeatures, yamlTarget, explicitAs } = args;
  const candidateName = findExistingInstallName(manifest, parsed);
  if (candidateName === null) return null;
  // `findExistingInstallName` only returns names that exist in `manifest`
  // (it iterates the same array), so the lookup is guaranteed to find a
  // match. No defensive null-check needed.
  const candidate = manifest.find((entry) => entry.name === candidateName)!;
  if (
    candidate.target !== yamlTarget ||
    candidate.as !== explicitAs ||
    !sameFeatureSet(candidate.features, entryFeatures)
  ) {
    return null;
  }
  return candidate.name;
}
