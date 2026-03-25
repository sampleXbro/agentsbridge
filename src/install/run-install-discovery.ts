/**
 * Discovery phase for agentsbridge install (native import + slice load + narrow).
 */

import { discoverFromContentRoot, featuresFromCanonical } from './discover-resources.js';
import { narrowDiscoveredForInstallScope } from './resource-selection.js';
import { prepareInstallDiscovery } from './prepare-install-discovery.js';
import type { PrepareInstallDiscoveryResult } from './prepare-install-discovery.js';
import type { CanonicalFiles } from '../core/types.js';
import type { ExtendPick } from '../config/schema.js';

export async function resolveDiscoveredForInstall(
  resolvedPath: string,
  contentRoot: string,
  pathInRepo: string,
  explicitTarget: string | undefined,
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

  const { canonical: discovered, implicitPick: sliceImplicitPick } = await discoverFromContentRoot(
    prep.discoveryRoot,
  );

  const implicitPick = sliceImplicitPick ?? prep.implicitPick;
  const narrowed = narrowDiscoveredForInstallScope(discovered, {
    implicitPick,
    scopedFeatures: prep.scopedFeatures,
  });
  const discoveredFeatures = featuresFromCanonical(narrowed);

  return { prep, discovered, implicitPick, narrowed, discoveredFeatures };
}
