/**
 * agentsmesh watch — watch canonical files and regenerate on change.
 */

import { join, relative } from 'node:path';
import chokidar from 'chokidar';
import { loadConfigFromDir } from '../../config/loader.js';
import { loadCanonicalWithExtends } from '../../canonical/extends.js';
import { runGenerate } from './generate.js';
import { runMatrix } from './matrix.js';
import { logger } from '../../utils/logger.js';

const DEBOUNCE_MS = 300;

function shouldIgnoreWatchPath(configDir: string, changedPath: string): boolean {
  const relPath = relative(configDir, changedPath).replace(/\\/g, '/');
  // Chokidar can report paths through different resolution layers; use `endsWith`
  // so we reliably ignore lock-file churn regardless of relative prefixing.
  return relPath.endsWith('.agentsmesh/.lock') || relPath.endsWith('.agentsmesh/.lock.tmp');
}

/**
 * Compute a fingerprint of current features for change detection.
 */
function featureFingerprint(
  features: string[],
  rulesCount: number,
  commandsCount: number,
  agentsCount: number,
  skillsCount: number,
  mcpServerCount: number,
  permissionsCount: number,
  hooksCount: number,
  ignoreCount: number,
): string {
  return JSON.stringify({
    features,
    rulesCount,
    commandsCount,
    agentsCount,
    skillsCount,
    mcpServerCount,
    permissionsCount,
    hooksCount,
    ignoreCount,
  });
}

/**
 * Run the watch command.
 * Watches .agentsmesh/ and agentsmesh.yaml. On change: debounce 300ms, re-run
 * generate, print compact summary, show matrix if features changed.
 * @param flags - CLI flags (targets, verbose)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Object with stop() to stop watching
 * @throws When not initialized (no agentsmesh.yaml)
 */
export async function runWatch(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<{ stop: () => Promise<void> }> {
  const root = projectRoot ?? process.cwd();
  const { configDir } = await loadConfigFromDir(root);

  const paths = [
    join(configDir, '.agentsmesh'),
    join(configDir, 'agentsmesh.yaml'),
    join(configDir, 'agentsmesh.local.yaml'),
  ];

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFingerprint: string | null = null;
  let stopped = false;
  let pendingRun: Promise<void> | null = null;

  const run = async (): Promise<void> => {
    if (stopped) return;
    debounceTimer = null;
    const { config, configDir: dir } = await loadConfigFromDir(root);
    const { canonical } = await loadCanonicalWithExtends(config, dir);

    const mcpServerCount = canonical.mcp ? Object.keys(canonical.mcp.mcpServers).length : 0;
    const permissionsCount = canonical.permissions
      ? canonical.permissions.allow.length + canonical.permissions.deny.length
      : 0;
    const hooksCount = canonical.hooks
      ? Object.values(canonical.hooks).reduce(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0,
        )
      : 0;
    const ignoreCount = canonical.ignore.length;
    const fp = featureFingerprint(
      config.features,
      canonical.rules.length,
      canonical.commands.length,
      canonical.agents.length,
      canonical.skills.length,
      mcpServerCount,
      permissionsCount,
      hooksCount,
      ignoreCount,
    );
    const featuresChanged = lastFingerprint !== null && lastFingerprint !== fp;
    lastFingerprint = fp;

    if (stopped) return;
    await runGenerate(flags, root, { printMatrix: false });

    if (stopped) return;
    if (featuresChanged) {
      await runMatrix(flags, root);
    } else {
      logger.info('Regenerated.');
    }
  };

  const scheduleRun = (): void => {
    const runPromise = run()
      .catch((err: unknown) => {
        if (!stopped) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(message);
        }
      })
      .finally(() => {
        if (pendingRun === runPromise) pendingRun = null;
      });
    pendingRun = runPromise;
  };

  const schedule = (): void => {
    if (stopped) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scheduleRun, DEBOUNCE_MS);
  };

  const watcher = chokidar.watch(paths, { ignoreInitial: true });
  watcher.on('all', (_eventName, changedPath) => {
    if (shouldIgnoreWatchPath(configDir, changedPath)) return;
    schedule();
  });

  logger.info('Watching .agentsmesh/ and agentsmesh.yaml...');
  pendingRun = run();
  await pendingRun;
  pendingRun = null;

  return {
    stop: async (): Promise<void> => {
      stopped = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await watcher.close();
      if (pendingRun) await pendingRun;
    },
  };
}
