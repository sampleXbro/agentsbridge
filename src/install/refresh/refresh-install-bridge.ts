/**
 * Bridge from a recorded install manifest entry back into the install
 * pipeline, with `forceFreshMaterialize: true`. Used by `applySinglePack`.
 *
 * Uses the `replay` arg of runInstall to skip lock re-acquisition (refresh's
 * orchestrator already holds the .install.lock). The replay scope carries
 * the entry's recorded features/pick so install honors the same selection.
 */

import { runInstall } from '../run/run-install.js';
import type { InstallManifestEntry } from '../core/install-manifest.js';
import type { InstallReplayScope } from '../run/install-replay.js';

export interface RunInstallForRefreshArgs {
  readonly projectRoot: string;
  readonly scope: 'project' | 'global';
}

export function createRunInstallForRefresh(args: RunInstallForRefreshArgs) {
  return async (entry: InstallManifestEntry, _newSha: string): Promise<void> => {
    const flags: Record<string, string | boolean> = {
      force: true,
      forceFreshMaterialize: true,
    };
    if (args.scope === 'global') flags.global = true;
    if (entry.target !== undefined) flags.target = entry.target;
    if (entry.as !== undefined) flags.as = entry.as;
    if (entry.path !== undefined) flags.path = entry.path;
    flags.name = entry.name;

    const replay: InstallReplayScope = {
      features: entry.features,
      pick: entry.pick,
    };

    const result = await runInstall(flags, [entry.source], args.projectRoot, replay);
    if (result.exitCode !== 0) {
      throw new Error(
        `Install for refresh "${entry.name}" failed with exit code ${result.exitCode}`,
      );
    }
  };
}
