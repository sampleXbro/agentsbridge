/**
 * agentsmesh generate — produce target files from canonical sources.
 */

import { join } from 'node:path';
import { loadScopedConfig } from '../../config/core/scope.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { buildChecksums, detectLockedFeatureViolations, readLock } from '../../config/core/lock.js';
import { generate as runEngine } from '../../core/generate/engine.js';
import { cleanupStaleGeneratedOutputs } from '../../core/generate/stale-cleanup.js';
import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { acquireProcessLock } from '../../utils/filesystem/process-lock.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import { logger } from '../../utils/output/logger.js';
import { ensurePathInsideRoot } from './generate-path.js';
import { writeLockFile } from './generate-lock.js';
import type { GenerateData } from '../command-result.js';
import type { ResolvedExtend } from '../../config/resolve/resolver.js';
import type { GenerateResult } from '../../core/result-types.js';

export interface GenerateCommandResult {
  exitCode: number;
  data: GenerateData;
}

export interface RunGenerateOptions {
  printMatrix?: boolean;
}

/**
 * Run the generate command.
 * @param flags - CLI flags (targets, dry-run, verbose)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runGenerate(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
  options: RunGenerateOptions = {},
): Promise<GenerateCommandResult> {
  if (flags.features !== undefined) {
    throw new Error('--features is no longer supported. Configure features in agentsmesh.yaml.');
  }

  const root = projectRoot ?? process.cwd();
  const checkOnly = flags.check === true;
  const dryRun = flags['dry-run'] === true;
  const force = flags.force === true;
  const scope = flags.global === true ? 'global' : 'project';
  const refreshRemoteCache = flags['refresh-cache'] === true || flags['no-cache'] === true;
  const targetStr = flags.targets;
  const targetFilter =
    typeof targetStr === 'string' && targetStr
      ? targetStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const mode: GenerateData['mode'] = checkOnly ? 'check' : dryRun ? 'dry-run' : 'generate';

  const { config, context } = await loadScopedConfig(root, scope);
  await bootstrapPlugins(config, root);
  const lockFeatures = config.collaboration?.lock_features ?? [];
  if (config.collaboration?.strategy === 'lock' && !force && lockFeatures.length > 0) {
    const existingLock = await readLock(context.canonicalDir);
    if (existingLock !== null) {
      const currentChecksums = await buildChecksums(context.canonicalDir);
      const violations = detectLockedFeatureViolations(
        existingLock.checksums,
        currentChecksums,
        lockFeatures,
      );
      if (violations.length > 0) {
        logger.error('Locked feature violation (strategy: lock). Modified files:');
        for (const violation of violations) {
          logger.error(`  ${violation}`);
        }
        logger.error("Run 'agentsmesh generate --force' to accept these changes.");
        throw new Error('Locked feature violation. Use --force to override.');
      }
    }
  }

  const { canonical, resolvedExtends } = await loadCanonicalWithExtends(
    config,
    context.configDir,
    {
      refreshRemoteCache,
    },
    context.canonicalDir,
  );
  const allTargets = [...config.targets, ...(config.pluginTargets ?? [])];
  if (targetFilter) {
    const unknown = targetFilter.filter((t) => !allTargets.includes(t));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown target(s) in --targets: ${unknown.join(', ')}. ` +
          `Available: ${allTargets.join(', ')}`,
      );
    }
  }
  const activeTargets = targetFilter
    ? allTargets.filter((t) => targetFilter.includes(t))
    : allTargets;

  const results = await runEngine({
    config,
    canonical,
    projectRoot: context.rootBase,
    scope,
    targetFilter,
  });

  if (results.length === 0) {
    return handleEmptyResults({
      mode,
      scope,
      dryRun,
      context,
      resolvedExtends,
      flags,
      root,
      options,
    });
  }

  if (checkOnly) {
    return buildCheckResult(results, scope);
  }

  return handleGenerateOrDryRun({
    results,
    dryRun,
    scope,
    mode,
    context,
    activeTargets,
    resolvedExtends,
    flags,
    root,
    options,
  });
}

/* ----- helpers ----- */

interface EmptyResultsArgs {
  mode: GenerateData['mode'];
  scope: 'project' | 'global';
  dryRun: boolean;
  context: { canonicalDir: string; configDir: string; rootBase: string };
  resolvedExtends: ResolvedExtend[];
  flags: Record<string, string | boolean>;
  root: string;
  options: RunGenerateOptions;
}

async function handleEmptyResults(args: EmptyResultsArgs): Promise<GenerateCommandResult> {
  const { mode, scope, dryRun, context, resolvedExtends, flags, root, options } = args;

  if (mode === 'check') {
    return { exitCode: 0, data: { scope, mode, files: [], summary: buildSummary([]) } };
  }

  if (!dryRun) {
    await writeLockFile(context, resolvedExtends);
  }

  if (options.printMatrix !== false) {
    const { runMatrix } = await import('./matrix.js');
    const { renderMatrix } = await import('../renderers/matrix.js');
    const matrixResult = await runMatrix(flags, root);
    renderMatrix(matrixResult, { verbose: flags.verbose === true });
  }

  return { exitCode: 0, data: { scope, mode, files: [], summary: buildSummary([]) } };
}

function buildCheckResult(
  results: GenerateResult[],
  scope: 'project' | 'global',
): GenerateCommandResult {
  const actionable = results.filter((r) => r.status !== 'skipped');
  const drifted = actionable.filter((r) => r.status !== 'unchanged');
  const files = actionable.map((r) => ({
    path: r.path,
    target: r.target,
    status: r.status as 'created' | 'updated' | 'unchanged',
  }));
  const exitCode = drifted.length === 0 ? 0 : 1;
  return { exitCode, data: { scope, mode: 'check', files, summary: buildSummary(actionable) } };
}

interface GenerateOrDryRunArgs {
  results: GenerateResult[];
  dryRun: boolean;
  scope: 'project' | 'global';
  mode: GenerateData['mode'];
  context: { canonicalDir: string; configDir: string; rootBase: string };
  activeTargets: string[];
  resolvedExtends: ResolvedExtend[];
  flags: Record<string, string | boolean>;
  root: string;
  options: RunGenerateOptions;
}

async function handleGenerateOrDryRun(args: GenerateOrDryRunArgs): Promise<GenerateCommandResult> {
  const {
    results,
    dryRun,
    scope,
    mode,
    context,
    activeTargets,
    resolvedExtends,
    flags,
    root,
    options,
  } = args;

  const release = dryRun
    ? null
    : await acquireProcessLock(join(context.canonicalDir, '.generate.lock'));
  try {
    if (!dryRun) {
      for (const r of results) {
        if (r.status === 'created' || r.status === 'updated') {
          const fullPath = ensurePathInsideRoot(context.rootBase, r.path, r.target);
          await writeFileAtomic(fullPath, r.content);
        }
      }
      await cleanupStaleGeneratedOutputs({
        projectRoot: context.rootBase,
        targets: activeTargets,
        expectedPaths: results.map((result) => result.path),
        scope,
      });
      await writeLockFile(context, resolvedExtends);
    }
  } finally {
    if (release) await release();
  }

  if (options.printMatrix !== false) {
    const { runMatrix } = await import('./matrix.js');
    const { renderMatrix } = await import('../renderers/matrix.js');
    const matrixResult = await runMatrix(flags, root);
    renderMatrix(matrixResult, { verbose: flags.verbose === true });
  }

  const actionable = results.filter((r) => r.status !== 'skipped');
  const files = actionable.map((r) => ({
    path: r.path,
    target: r.target,
    status: r.status as 'created' | 'updated' | 'unchanged',
  }));
  return { exitCode: 0, data: { scope, mode, files, summary: buildSummary(actionable) } };
}

function buildSummary(results: Array<{ status: string }>): GenerateData['summary'] {
  return {
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    unchanged: results.filter((r) => r.status === 'unchanged').length,
  };
}
