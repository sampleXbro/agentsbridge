/**
 * Body of `runInstall` that runs while the `.install.lock` is held.
 * Split from `run-install.ts` at the lock boundary so the orchestrator
 * file stays under the 200-line cap.
 */

import { join, normalize } from 'node:path';
import { loadScopedConfig } from '../../config/core/scope.js';
import { exists } from '../../utils/filesystem/fs.js';
import { resolveInstallResolvedPath } from './run-install-resolve.js';
import { isGitAvailable } from '../source/git-pin.js';
import { parseInstallSource } from '../source/url-parser.js';
import { resolveInstallDiscovery, deriveSourceType } from '../core/install-discovery.js';
import { selectInstallCandidates } from '../picker/select-candidates.js';
import { runInstallMarketplace } from './run-install-marketplace.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import { type InstallReplayScope } from './install-replay.js';
import { resolveManualInstallPersistence } from '../manual/manual-install-persistence.js';
import { executeRunInstallPoolsAndWrite } from './run-install-execute.js';
import { runPromptFlowWithAbort } from './run-install-prompts.js';
import { handleSync } from './run-install-sync-locked.js';
import { createInstallReport } from '../core/install-report.js';
import type { InstallData } from '../../cli/command-result.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';

export interface InstallCommandResult {
  exitCode: number;
  data: InstallData;
}

export interface RunInstallLockedArgs {
  args: string[];
  projectRoot: string;
  replay: InstallReplayScope | undefined;
  sync: boolean;
  dryRun: boolean;
  force: boolean;
  useExtends: boolean;
  all?: boolean;
  explicitPath?: string;
  explicitTarget?: string;
  explicitAs?: ManualInstallAs;
  nameOverride: string;
  scope: 'global' | 'project';
  sourceArg: string | undefined;
  recurseInstall: (
    flags: Record<string, string | boolean>,
    args: string[],
    projectRoot: string,
    replay?: InstallReplayScope,
  ) => Promise<InstallCommandResult>;
}

function assertPathStaysInRepo(pathInRepo: string, originalPath: string): void {
  if (!pathInRepo) return;
  const normalized = normalize(pathInRepo).replace(/\\/g, '/');
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(
      `Install --path "${originalPath}" escapes the source root. Path must stay within the source.`,
    );
  }
}

export async function runInstallLocked(opts: RunInstallLockedArgs): Promise<InstallCommandResult> {
  const synced = await handleSync(opts);
  if (synced) return synced;

  const {
    projectRoot,
    replay,
    dryRun,
    force,
    useExtends,
    all,
    explicitPath,
    explicitTarget,
    explicitAs,
    nameOverride,
    scope,
    sourceArg,
  } = opts;

  if (!sourceArg) {
    throw new Error(
      'Missing source. Usage: agentsmesh install <source> [--path ...] [--target ...]',
    );
  }
  const tty = process.stdin.isTTY;
  if (!tty && !force && !dryRun) {
    throw new Error('Non-interactive terminal: use --force or --dry-run for agentsmesh install.');
  }
  const { config, context } = await loadScopedConfig(projectRoot, scope);
  await bootstrapPlugins(config, projectRoot);
  const parsed = await parseInstallSource(sourceArg, context.configDir, explicitPath);
  if (parsed.kind !== 'local' && !(await isGitAvailable())) {
    throw new Error('git is required for remote installs. Please install git and try again.');
  }
  const { resolvedPath, sourceForYaml, version } = await resolveInstallResolvedPath(
    parsed,
    sourceArg,
  );
  const pathInRepo = parsed.pathInRepo.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  assertPathStaysInRepo(pathInRepo, parsed.pathInRepo);
  const contentRoot = pathInRepo ? join(resolvedPath, pathInRepo) : resolvedPath;
  if (!(await exists(contentRoot))) throw new Error(`Install path does not exist: ${contentRoot}`);
  const persisted = await resolveManualInstallPersistence({
    as: explicitAs,
    contentRoot,
    pathInRepo,
  });
  const installReport = createInstallReport();
  const parseOpts = {
    onParseError: (err: Error, filePath: string): void => {
      installReport.brokenResources.push({
        path: filePath,
        kind: 'frontmatter' as const,
        reason: err.message,
      });
    },
  };

  const discovery = await resolveInstallDiscovery({
    resolvedPath,
    contentRoot,
    pathInRepo,
    explicitTarget,
    explicitAs,
    replayPick: replay?.pick,
    parseOpts,
  });

  // Picker: check if layout detection found targets (marketplace or flat collections)
  if (discovery.layout && !explicitAs && !explicitTarget && !explicitPath) {
    const pickerResult = selectInstallCandidates({
      layout: discovery.layout,
      sourceName:
        nameOverride || (parsed.org && parsed.repo ? `${parsed.org}-${parsed.repo}` : 'source'),
      sourceForYaml,
      explicitPath,
      explicitAs,
      explicitTarget,
      all,
      force,
      tty,
    });
    if (pickerResult.isMarketplace && pickerResult.targets.length > 0) {
      const mpResult = await runInstallMarketplace(
        pickerResult.targets,
        async (target) => {
          const sub = await opts.recurseInstall(
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
      return opts.recurseInstall(
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
  }

  return runSinglePackInstall(
    opts,
    discovery,
    installReport,
    persisted,
    parsed,
    sourceForYaml,
    version,
    pathInRepo,
    contentRoot,
    config,
    context,
  );
}

async function runSinglePackInstall(
  opts: RunInstallLockedArgs,
  discovery: Awaited<ReturnType<typeof resolveInstallDiscovery>>,
  installReport: ReturnType<typeof createInstallReport>,
  persisted: Awaited<ReturnType<typeof resolveManualInstallPersistence>>,
  parsed: Awaited<ReturnType<typeof parseInstallSource>>,
  sourceForYaml: string,
  version: string | undefined,
  pathInRepo: string,
  contentRoot: string,
  config: Awaited<ReturnType<typeof loadScopedConfig>>['config'],
  context: Awaited<ReturnType<typeof loadScopedConfig>>['context'],
): Promise<InstallCommandResult> {
  const { dryRun, force, useExtends, explicitAs, nameOverride, scope, sourceArg, replay } = opts;
  const tty = process.stdin.isTTY;
  const { prep, implicitPick } = discovery;
  let { narrowed, discoveredFeatures } = discovery;
  try {
    const flow = await runPromptFlowWithAbort({
      discovery,
      contentRoot,
      bypass: force || dryRun || !tty,
    });
    if (flow.aborted) {
      return {
        exitCode: 130,
        data: { source: sourceArg!, mode: 'install', installed: [], skipped: [], dryRun },
      };
    }
    narrowed = flow.narrowed ?? narrowed;
    discoveredFeatures = flow.discoveredFeatures ?? discoveredFeatures;
    if (discoveredFeatures.length === 0 && installReport.brokenResources.length > 0) {
      const list = installReport.brokenResources
        .map((b) => `  - ${b.path}: ${b.reason}`)
        .join('\n');
      throw new Error(
        `No installable resources after skipping invalid files (${installReport.brokenResources.length}):\n${list}`,
      );
    }
    const executeResult = await executeRunInstallPoolsAndWrite({
      scope,
      force,
      dryRun,
      tty,
      useExtends,
      nameOverride,
      explicitAs,
      config,
      context,
      parsed,
      sourceForYaml,
      version,
      pathInRepo,
      persisted,
      replay,
      prep,
      implicitPick,
      narrowed,
      discoveredFeatures,
      sourceType: discovery.layout ? deriveSourceType(discovery.layout) : undefined,
    });
    return {
      exitCode: 0,
      data: {
        source: sourceArg!,
        mode: 'install',
        installed: executeResult.installed,
        skipped: executeResult.skipped,
        dryRun,
        ...(installReport.brokenResources.length > 0
          ? { brokenResources: installReport.brokenResources }
          : {}),
      },
    };
  } finally {
    if (prep.cleanup) await prep.cleanup();
  }
}
