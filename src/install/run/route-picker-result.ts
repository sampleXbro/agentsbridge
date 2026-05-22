/**
 * Picker dispatch: given the layout-detection picker result, recurse into the
 * marketplace fan-out OR fold a single-candidate result back into a normal
 * `recurseInstall(...)` call.
 *
 * Returns `null` when no recursion happens — the caller falls through to the
 * single-pack install path.
 */

import type { selectInstallCandidates } from '../picker/select-candidates.js';
import { runInstallMarketplace } from './run-install-marketplace.js';
import type { createInstallReport } from '../core/install-report.js';
import type { InstallReplayScope } from './install-replay.js';
import type { InstallCommandResult } from './single-pack-install.js';

export interface RoutePickerResultArgs {
  readonly pickerResult: ReturnType<typeof selectInstallCandidates>;
  readonly installReport: ReturnType<typeof createInstallReport>;
  readonly sourceArg: string;
  readonly projectRoot: string;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly useExtends: boolean;
  readonly nameOverride: string;
  readonly replay: InstallReplayScope | undefined;
  readonly recurseInstall: (
    flags: Record<string, string | boolean>,
    args: string[],
    projectRoot: string,
    replay?: InstallReplayScope,
  ) => Promise<InstallCommandResult>;
}

export async function routePickerResult(
  args: RoutePickerResultArgs,
): Promise<InstallCommandResult | null> {
  const {
    pickerResult,
    installReport,
    sourceArg,
    projectRoot,
    dryRun,
    force,
    useExtends,
    nameOverride,
    replay,
    recurseInstall,
  } = args;

  if (pickerResult.isMarketplace && pickerResult.targets.length > 0) {
    const mpResult = await runInstallMarketplace(
      pickerResult.targets,
      async (target) => {
        const sub = await recurseInstall(
          {
            force: true,
            'dry-run': dryRun,
            path: target.path ?? '',
            target: target.target ?? '',
            name: target.name,
            extends: useExtends,
          },
          [sourceArg],
          projectRoot,
          {},
        );
        return sub.data;
      },
      installReport,
    );
    return {
      exitCode: mpResult.exitCode,
      data: {
        source: sourceArg,
        mode: 'install' as const,
        installed: mpResult.installed,
        skipped: mpResult.skipped,
        dryRun,
        ...(installReport.brokenResources.length > 0
          ? { brokenResources: installReport.brokenResources }
          : {}),
      },
    };
  }
  if (!pickerResult.isMarketplace && pickerResult.targets.length === 1) {
    const target = pickerResult.targets[0]!;
    // Pass `replay ?? {}` so the nested `runInstall` skips re-acquiring the
    // install lock we already hold. Marketplace recursion uses the same
    // workaround; normal call sites never reach this branch.
    return recurseInstall(
      {
        force,
        'dry-run': dryRun,
        path: target.path ?? '',
        as: target.as ?? '',
        target: target.target ?? '',
        name: nameOverride,
        extends: useExtends,
      },
      [sourceArg],
      projectRoot,
      replay ?? {},
    );
  }
  return null;
}
