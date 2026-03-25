/**
 * Discovery flow for explicit `install --as ...` manual collection installs.
 */

import type { ExtendPick } from '../config/schema.js';
import { discoverFromContentRoot, featuresFromCanonical } from './discover-resources.js';
import { narrowDiscoveredForInstallScope } from './resource-selection.js';
import { stageManualInstallScope } from './manual-install-scope.js';
import type { ManualInstallAs } from './manual-install-mode.js';

export async function resolveManualDiscoveredForInstall(
  sourceRoot: string,
  explicitAs: ManualInstallAs,
  explicitTarget?: string,
  replayPick?: ExtendPick,
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
  const { canonical } = await discoverFromContentRoot(staged.discoveryRoot);
  const narrowed = narrowDiscoveredForInstallScope(canonical, {
    scopedFeatures: [explicitAs],
  });
  return {
    prep: {
      yamlTarget: explicitTarget,
      scopedFeatures: [explicitAs],
      cleanup: staged.cleanup,
    },
    narrowed,
    discoveredFeatures: featuresFromCanonical(narrowed),
  };
}
