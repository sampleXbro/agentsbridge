/**
 * agentsmesh install orchestration.
 */

import { join } from 'node:path';
import { loadScopedConfig } from '../../config/core/scope.js';
import { exists } from '../../utils/filesystem/fs.js';
import { resolveInstallResolvedPath } from './run-install-resolve.js';
import { isGitAvailable } from '../source/git-pin.js';
import { parseInstallSource } from '../source/url-parser.js';
import { maybeRunInstallSync } from './install-sync.js';
import { readInstallFlags } from '../core/install-flags.js';
import { resolveInstallDiscovery } from '../core/install-discovery.js';
import { type InstallReplayScope } from './install-replay.js';
import { resolveManualInstallPersistence } from '../manual/manual-install-persistence.js';
import { executeRunInstallPoolsAndWrite } from './run-install-execute.js';
export async function runInstall(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
  replay?: InstallReplayScope,
): Promise<void> {
  const {
    sync,
    dryRun,
    force,
    useExtends,
    explicitPath,
    explicitTarget,
    explicitAs,
    nameOverride,
  } = readInstallFlags(flags);
  const scope = flags.global === true ? 'global' : 'project';
  const sourceArg = args[0]?.trim();
  if (sync) {
    const { context } = await loadScopedConfig(projectRoot, scope);
    if (
      await maybeRunInstallSync({
        sync,
        canonicalDir: context.canonicalDir,
        reinstall: async (entry) => {
          const replayPaths = entry.paths && entry.paths.length > 0 ? entry.paths : [entry.path];
          for (const replayPath of replayPaths) {
            await runInstall(
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
          }
        },
      })
    ) {
      return;
    }
  }

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
  const contentRoot = pathInRepo ? join(resolvedPath, pathInRepo) : resolvedPath;
  if (pathInRepo && !contentRoot.startsWith(resolvedPath + '/') && contentRoot !== resolvedPath) {
    throw new Error(
      `Install --path "${parsed.pathInRepo}" escapes the source root. Path must stay within the source.`,
    );
  }
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
    await executeRunInstallPoolsAndWrite({
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
  } finally {
    if (prep.cleanup) {
      await prep.cleanup();
    }
  }
}
