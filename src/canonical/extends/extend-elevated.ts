/**
 * Consent gate for elevated artifacts (`hooks`, `permissions`, `mcp`) coming
 * from an `extends` source. Mirrors the `install` gate
 * (`stripUntrustedElevatedArtifacts`): a remote extend (github/gitlab/git,
 * including `git+file://`) ships these only if the entry opts in via `accept:`;
 * a local extend is trusted as-is. The check runs per-extend, before its slice
 * is merged into the canonical config.
 */

import type { CanonicalFiles } from '../../core/types.js';
import {
  stripUntrustedElevatedArtifacts,
  type ElevatedArtifact,
  type ElevatedArtifactGateResult,
} from '../../install/core/elevated-artifacts.js';

export interface ExtendElevatedGateInput {
  /** True for remote sources (stripped by default); false for trusted local paths. */
  readonly isRemote: boolean;
  /** Artifacts the entry consents to keep from a remote source. */
  readonly accept?: readonly ElevatedArtifact[];
}

/**
 * Apply the elevated-artifact consent gate to one extend's canonical slice.
 */
export function gateExtendElevatedArtifacts(
  canonical: CanonicalFiles,
  ext: ExtendElevatedGateInput,
): ElevatedArtifactGateResult {
  const accept = ext.accept ?? [];
  return stripUntrustedElevatedArtifacts(canonical, {
    sourceKind: ext.isRemote ? 'git' : 'local',
    acceptHooks: accept.includes('hooks'),
    acceptPermissions: accept.includes('permissions'),
    acceptMcp: accept.includes('mcp'),
  });
}
