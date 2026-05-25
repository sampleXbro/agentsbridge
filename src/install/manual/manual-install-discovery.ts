/**
 * Discovery flow for explicit `install --as ...` manual collection installs.
 */

import type { ExtendPick } from '../../config/core/schema.js';
import type { ParseFrontmatterOptions } from '../../canonical/features/rules.js';
import { discoverFromContentRoot, featuresFromCanonical } from '../core/discover-resources.js';
import { narrowDiscoveredForInstallScope } from '../core/resource-selection.js';
import { stageManualInstallScope } from './manual-install-scope.js';
import type { ManualInstallAs } from './manual-install-mode.js';

export async function resolveManualDiscoveredForInstall(
  sourceRoot: string,
  explicitAs: ManualInstallAs,
  explicitTarget?: string,
  replayPick?: ExtendPick,
  parseOpts: ParseFrontmatterOptions = {},
): Promise<{
  prep: {
    yamlTarget?: string;
    scopedFeatures?: string[];
    cleanup: () => Promise<void>;
  };
  narrowed: Awaited<ReturnType<typeof discoverFromContentRoot>>['canonical'];
  discoveredFeatures: string[];
}> {
  const staged = await stageManualInstallScope(sourceRoot, explicitAs, {
    preferredSkillNames: explicitAs === 'skills' ? replayPick?.skills : undefined,
  });
  const { canonical, cleanup: sliceCleanup } = await discoverFromContentRoot(
    staged.discoveryRoot,
    parseOpts,
  );
  const narrowed = narrowDiscoveredForInstallScope(canonical, {
    scopedFeatures: [explicitAs],
  });
  const combinedCleanup = async (): Promise<void> => {
    // Slice-level staging dirs (target-mapper output) must be cleaned up
    // alongside the manual-scope staging dir. Best-effort: a failure in one
    // shouldn't strand the other.
    await Promise.allSettled([sliceCleanup(), staged.cleanup()]);
  };
  return {
    prep: {
      yamlTarget: explicitTarget,
      scopedFeatures: [explicitAs],
      cleanup: combinedCleanup,
    },
    narrowed,
    discoveredFeatures: featuresFromCanonical(narrowed),
  };
}
