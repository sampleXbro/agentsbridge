/**
 * Choose manual or native install discovery based on explicit flags.
 */

import { resolveManualDiscoveredForInstall } from './manual-install-discovery.js';
import { resolveDiscoveredForInstall } from './run-install-discovery.js';
import type { ExtendPick } from '../config/schema.js';
import type { ManualInstallAs } from './manual-install-mode.js';

export async function resolveInstallDiscovery(args: {
  resolvedPath: string;
  contentRoot: string;
  pathInRepo: string;
  explicitTarget?: string;
  explicitAs?: ManualInstallAs;
  replayPick?: ExtendPick;
}): Promise<ReturnType<typeof resolveDiscoveredForInstall>> {
  if (args.explicitAs) {
    return {
      implicitPick: undefined,
      ...(await resolveManualDiscoveredForInstall(
        args.contentRoot,
        args.explicitAs,
        args.explicitTarget,
        args.replayPick,
      )),
    } as Awaited<ReturnType<typeof resolveDiscoveredForInstall>>;
  }
  return resolveDiscoveredForInstall(
    args.resolvedPath,
    args.contentRoot,
    args.pathInRepo,
    args.explicitTarget,
  );
}
