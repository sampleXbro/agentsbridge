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
import { resolveInstallDiscovery } from '../core/install-discovery.js';
import { type InstallReplayScope } from './install-replay.js';
import { resolveManualInstallPersistence } from '../manual/manual-install-persistence.js';
import { executeRunInstallPoolsAndWrite } from './run-install-execute.js';
import { runPromptFlowWithAbort } from './run-install-prompts.js';
import { handleSync } from './run-install-sync-locked.js';
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
  // Normalize backslash separators to forward slashes before stripping
  // leading/trailing slashes so a Windows-authored `--path \\src\\foo\\`
  // joins correctly under POSIX `resolvedPath`.
  const pathInRepo = parsed.pathInRepo.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
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
  const discovery = await resolveInstallDiscovery({
    resolvedPath,
    contentRoot,
    pathInRepo,
    explicitTarget,
    explicitAs,
    replayPick: replay?.pick,
  });
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
        data: {
          source: sourceArg,
          mode: 'install' as const,
          installed: [],
          skipped: [],
          dryRun,
        },
      };
    }
    narrowed = flow.narrowed ?? narrowed;
    discoveredFeatures = flow.discoveredFeatures ?? discoveredFeatures;
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
      sourceType: discovery.classification?.type,
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
