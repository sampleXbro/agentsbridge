/**
 * Discovery phase for agentsmesh install (native import + slice load + narrow).
 */

import { discoverFromContentRoot, featuresFromCanonical } from '../core/discover-resources.js';
import { narrowDiscoveredForInstallScope } from '../core/resource-selection.js';
import { prepareInstallDiscovery } from '../core/prepare-install-discovery.js';
import type { PrepareInstallDiscoveryResult } from '../core/prepare-install-discovery.js';
import type { CanonicalFiles } from '../../core/types.js';
import type { ExtendPick } from '../../config/core/schema.js';
import type { ParseFrontmatterOptions } from '../../canonical/features/rules.js';

export async function resolveDiscoveredForInstall(
  resolvedPath: string,
  contentRoot: string,
  pathInRepo: string,
  explicitTarget: string | undefined,
  parseOpts: ParseFrontmatterOptions = {},
): Promise<{
  prep: PrepareInstallDiscoveryResult;
  discovered: CanonicalFiles;
  implicitPick: ExtendPick | undefined;
  narrowed: CanonicalFiles;
  discoveredFeatures: string[];
}> {
  const prep = await prepareInstallDiscovery(resolvedPath, contentRoot, pathInRepo, {
    explicitTarget,
  });

  const {
    canonical: discovered,
    implicitPick: sliceImplicitPick,
    cleanup: sliceCleanup,
  } = await discoverFromContentRoot(prep.discoveryRoot, parseOpts);

  // Merge any slice-level staging cleanup (target-mapper tmpdirs) into
  // `prep.cleanup` so `runSinglePackInstall`'s `finally` runs both. The
  // prep cleanup may not exist (no native staging happened); the slice
  // cleanup is always present even when a no-op.
  const prepCleanup = prep.cleanup;
  const mergedCleanup = async (): Promise<void> => {
    await Promise.allSettled([sliceCleanup(), ...(prepCleanup ? [prepCleanup()] : [])]);
  };
  const prepWithSliceCleanup = { ...prep, cleanup: mergedCleanup };

  const implicitPick = sliceImplicitPick ?? prep.implicitPick;
  const narrowed = narrowDiscoveredForInstallScope(discovered, {
    implicitPick,
    scopedFeatures: prep.scopedFeatures,
  });
  const discoveredFeatures = featuresFromCanonical(narrowed);

  return { prep: prepWithSliceCleanup, discovered, implicitPick, narrowed, discoveredFeatures };
}
