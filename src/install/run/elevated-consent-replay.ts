/**
 * Bridge state for replayed installs (refresh / sync): elevated-artifact
 * consent and the original branch/tag pin.
 *
 * Both pieces of state are recorded in `installs.yaml` at first install and
 * must round-trip through the sync/refresh bridges so a deterministic re-clone
 * (a) re-applies the user's `--accept-*` decisions instead of silently
 * stripping trusted artifacts, and (b) keeps a branch pin (`@main`) tracking
 * the branch rather than freezing it into the resolved SHA.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { ElevatedArtifact } from '../core/elevated-artifacts.js';
import type { InstallReplayScope } from './install-replay.js';
import type { ParsedInstallSource } from '../source/parse-install-source.js';

const ELEVATED_ARTIFACTS: readonly ElevatedArtifact[] = ['hooks', 'permissions', 'mcp'];

export interface ResolvedConsent {
  readonly acceptHooks: boolean;
  readonly acceptPermissions: boolean;
  readonly acceptMcp: boolean;
}

/**
 * Merge the caller's explicit `--accept-*` flags with any consent replayed
 * from a prior installs.yaml entry.
 */
export function resolveElevatedConsent(
  flags: ResolvedConsent,
  replay: InstallReplayScope | undefined,
): ResolvedConsent {
  const replayed = new Set(replay?.acceptedElevated ?? []);
  return {
    acceptHooks: flags.acceptHooks || replayed.has('hooks'),
    acceptPermissions: flags.acceptPermissions || replayed.has('permissions'),
    acceptMcp: flags.acceptMcp || replayed.has('mcp'),
  };
}

/**
 * The elevated artifacts the user consented to AND that actually survived the
 * gate into the pack. Persisted so the bridges can re-apply that consent on
 * the next replay. Returns `undefined` when nothing was consented (so the
 * field is omitted from `installs.yaml` rather than written as an empty list).
 */
export function consentedArtifactsForManifest(
  effectiveNarrowed: CanonicalFiles,
  consent: ResolvedConsent,
): ElevatedArtifact[] | undefined {
  const accepted: Record<ElevatedArtifact, boolean> = {
    hooks: consent.acceptHooks,
    permissions: consent.acceptPermissions,
    mcp: consent.acceptMcp,
  };
  const result = ELEVATED_ARTIFACTS.filter(
    (artifact) => effectiveNarrowed[artifact] !== null && accepted[artifact],
  );
  return result.length > 0 ? result : undefined;
}

/**
 * The ref expression to persist as `original_ref`. Prefer the prior entry's
 * recorded pin (threaded via the replay scope) over the now SHA-pinned
 * source's raw ref so a refresh/sync never freezes a branch pin into a SHA.
 */
export function resolveOriginalRef(
  parsed: ParsedInstallSource,
  replay: InstallReplayScope | undefined,
): string | undefined {
  if (replay?.originalRef !== undefined && replay.originalRef !== '') {
    return replay.originalRef;
  }
  return parsed.rawRef !== '' ? parsed.rawRef : undefined;
}

/**
 * Drop stripped elevated artifacts from the discovered feature list so the
 * recorded `features` never claims hooks/permissions/mcp the pack does not
 * actually contain (metadata/content desync).
 */
export function featuresAfterStrip(
  discoveredFeatures: string[],
  stripped: readonly ElevatedArtifact[],
): string[] {
  if (stripped.length === 0) return discoveredFeatures;
  const strippedSet = new Set<string>(stripped);
  return discoveredFeatures.filter((feature) => !strippedSet.has(feature));
}
