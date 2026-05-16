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
import { maybeRunInstallSync } from './install-sync.js';
import { resolveInstallDiscovery } from '../core/install-discovery.js';
import { type InstallReplayScope } from './install-replay.js';
import { resolveManualInstallPersistence } from '../manual/manual-install-persistence.js';
import {
  executeRunInstallPoolsAndWrite,
  type InstallExecuteResult,
} from './run-install-execute.js';
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
  explicitPath?: string;
  explicitTarget?: string;
  explicitAs?: ManualInstallAs;
  nameOverride: string;
  scope: 'global' | 'project';
  sourceArg: string | undefined;
  /** Recursive `runInstall` injected to drive sync-replay without an import cycle. */
  recurseInstall: (
    flags: Record<string, string | boolean>,
    args: string[],
    projectRoot: string,
    replay?: InstallReplayScope,
  ) => Promise<InstallCommandResult>;
}

async function handleSync(opts: RunInstallLockedArgs): Promise<InstallCommandResult | undefined> {
  const { projectRoot, sync, dryRun, force, scope, recurseInstall } = opts;
  if (!sync) return undefined;

  const { context } = await loadScopedConfig(projectRoot, scope);
  const syncInstalled: InstallExecuteResult['installed'] = [];
  const syncSkipped: InstallExecuteResult['skipped'] = [];
  const handled = await maybeRunInstallSync({
    sync,
    canonicalDir: context.canonicalDir,
    reinstall: async (entry) => {
      const replayPaths = entry.paths && entry.paths.length > 0 ? entry.paths : [entry.path];
      for (const replayPath of replayPaths) {
        const result = await recurseInstall(
          {
            ...(force ? { force: true } : {}),
            ...(dryRun ? { 'dry-run': true } : {}),
            ...(scope === 'global' ? { global: true } : {}),
            name: entry.name,
            ...(entry.target ? { target: entry.target } : {}),
            ...(replayPath ? { path: replayPath } : {}),
            ...(entry.as ? { as: entry.as } : {}),
          },
          [entry.source],
          projectRoot,
          { features: entry.features, pick: entry.pick },
        );
        syncInstalled.push(...result.data.installed);
        syncSkipped.push(...result.data.skipped);
      }
    },
  });
  if (!handled) return undefined;
  return {
    exitCode: 0,
    data: {
      source: '',
      mode: 'sync' as const,
      installed: syncInstalled,
      skipped: syncSkipped,
      dryRun,
    },
  };
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
  const parsed = await parseInstallSource(sourceArg, context.configDir, explicitPath);
  if (parsed.kind !== 'local' && !(await isGitAvailable())) {
    throw new Error('git is required for remote installs. Please install git and try again.');
  }
  const { resolvedPath, sourceForYaml, version } = await resolveInstallResolvedPath(
    parsed,
    sourceArg,
  );
  const pathInRepo = parsed.pathInRepo.replace(/^\/+|\/+$/g, '');
  assertPathStaysInRepo(pathInRepo, parsed.pathInRepo);
  const contentRoot = pathInRepo ? join(resolvedPath, pathInRepo) : resolvedPath;
  if (!(await exists(contentRoot))) {
    throw new Error(`Install path does not exist: ${contentRoot}`);
  }
  const persisted = await resolveManualInstallPersistence({
    as: explicitAs,
    contentRoot,
    pathInRepo,
  });
  const { prep, implicitPick, narrowed, discoveredFeatures } = await resolveInstallDiscovery({
    resolvedPath,
    contentRoot,
    pathInRepo,
    explicitTarget,
    explicitAs,
    replayPick: replay?.pick,
  });
  try {
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
    });
    return {
      exitCode: 0,
      data: {
        source: sourceArg,
        mode: 'install' as const,
        installed: executeResult.installed,
        skipped: executeResult.skipped,
        dryRun,
      },
    };
  } finally {
    if (prep.cleanup) {
      await prep.cleanup();
    }
  }
}
