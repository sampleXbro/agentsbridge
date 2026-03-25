/**
 * Apply saved install manifest scope when replaying `install --sync`.
 */

import type { ValidatedConfig } from '../config/schema.js';
import type { CanonicalFiles } from '../core/types.js';
import { featuresFromCanonical } from './discover-resources.js';
import { narrowDiscoveredForInstallScope } from './resource-selection.js';

export interface InstallReplayScope {
  features?: ValidatedConfig['features'];
  pick?: NonNullable<ValidatedConfig['extends'][number]['pick']>;
}

export function applyReplayInstallScope(
  narrowed: CanonicalFiles,
  discoveredFeatures: string[],
  replay?: InstallReplayScope,
): { narrowed: CanonicalFiles; discoveredFeatures: string[] } {
  if (!replay?.features && !replay?.pick) {
    return { narrowed, discoveredFeatures };
  }
  const replayNarrowed = narrowDiscoveredForInstallScope(narrowed, {
    scopedFeatures: replay.features,
    implicitPick: replay.pick,
  });
  return {
    narrowed: replayNarrowed,
    discoveredFeatures: featuresFromCanonical(replayNarrowed),
  };
}
