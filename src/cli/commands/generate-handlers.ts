/**
 * Helper functions for the generate command.
 * Extracted from generate.ts to keep file sizes under 200 lines.
 */

import { join } from 'node:path';
import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { acquireProcessLock } from '../../utils/filesystem/process-lock.js';
import { cleanupStaleGeneratedOutputs } from '../../core/generate/stale-cleanup.js';
import { getTargetLayout } from '../../targets/catalog/builtin-targets.js';
import { ensurePathInsideRoot } from './generate-path.js';
import { writeLockFile } from './generate-lock.js';
import { buildOutputChecksums } from '../../config/core/lock-outputs.js';
import { readLock } from '../../config/core/lock.js';
import type { GenerateData } from '../command-result.js';
import type { ResolvedExtend } from '../../config/resolve/resolver.js';
import type { GenerateResult } from '../../core/result-types.js';
import type { GenerateCommandResult, RunGenerateOptions } from './generate.js';

export interface EmptyResultsArgs {
  mode: GenerateData['mode'];
  scope: 'project' | 'global';
  dryRun: boolean;
  context: { canonicalDir: string; configDir: string; rootBase: string };
  resolvedExtends: ResolvedExtend[];
  flags: Record<string, string | boolean>;
  root: string;
  options: RunGenerateOptions;
  activeTargets: string[];
}

/**
 * A run is "filtered" when it targets a subset via `--targets`/`--features`.
 * Filtered runs merge into the lock's existing outputs (never prune); full runs
 * replace the map outright so disabled targets' entries drop off.
 */
function isFilteredRun(flags: Record<string, string | boolean>): boolean {
  return flags.targets !== undefined || flags.features !== undefined;
}

/**
 * In global scope, returns `'no-global-support'` when every active target
 * lacks a global layout (e.g. cloud-only jules/replit-agent). That, not a
 * missing root rule, is the real reason `generate --global` emitted nothing.
 */
function resolveEmptyReason(
  scope: 'project' | 'global',
  activeTargets: string[],
): GenerateData['emptyReason'] {
  if (scope !== 'global' || activeTargets.length === 0) return undefined;
  const allLackGlobal = activeTargets.every((t) => getTargetLayout(t, 'global') === undefined);
  return allLackGlobal ? 'no-global-support' : undefined;
}

export async function handleEmptyResults(args: EmptyResultsArgs): Promise<GenerateCommandResult> {
  const { mode, scope, dryRun, context, resolvedExtends, flags, root, options, activeTargets } =
    args;
  const emptyReason = resolveEmptyReason(scope, activeTargets);

  if (mode === 'check') {
    return {
      exitCode: 0,
      data: { scope, mode, files: [], summary: buildSummary([]), emptyReason },
    };
  }

  if (!dryRun) {
    // An empty run emits nothing, but it must not FORGET what earlier runs
    // wrote: that outputs map is the directory sweep's only provenance record,
    // and wiping it to `{}` would leave those files undeletable forever.
    const previousOutputs = (await readLock(context.canonicalDir))?.outputs ?? {};
    await writeLockFile(context, resolvedExtends, previousOutputs, isFilteredRun(flags));
  }

  if (options.printMatrix !== false) {
    const { runMatrix } = await import('./matrix.js');
    const { renderMatrix } = await import('../renderers/matrix.js');
    const matrixResult = await runMatrix(flags, root);
    renderMatrix(matrixResult, { verbose: flags.verbose === true });
  }

  return {
    exitCode: 0,
    data: { scope, mode, files: [], summary: buildSummary([]), emptyReason },
  };
}

export function buildCheckResult(
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

export interface GenerateOrDryRunArgs {
  results: GenerateResult[];
  dryRun: boolean;
  scope: 'project' | 'global';
  mode: GenerateData['mode'];
  context: { canonicalDir: string; configDir: string; rootBase: string };
  activeTargets: string[];
  /** Every target in the config, so cleanup can spot the ones this run skipped. */
  configuredTargets: string[];
  resolvedExtends: ResolvedExtend[];
  flags: Record<string, string | boolean>;
  root: string;
  options: RunGenerateOptions;
}

export async function handleGenerateOrDryRun(
  args: GenerateOrDryRunArgs,
): Promise<GenerateCommandResult> {
  const {
    results,
    dryRun,
    scope,
    mode,
    context,
    activeTargets,
    configuredTargets,
    resolvedExtends,
    flags,
    root,
    options,
  } = args;

  const release = dryRun
    ? null
    : await acquireProcessLock(join(context.canonicalDir, '.generate.lock'), {
        label: 'generate lock',
      });
  try {
    if (!dryRun) {
      for (const r of results) {
        if (r.status === 'created' || r.status === 'updated') {
          const fullPath = ensurePathInsideRoot(context.rootBase, r.path, r.target);
          await writeFileAtomic(fullPath, r.content);
        }
      }
      // The lock on disk is still the PREVIOUS run's until `writeLockFile`
      // below, so its outputs map is exactly the provenance the sweep needs.
      // Absent (fresh project, or a lock predating the map) → an empty set, so
      // the sweep deletes nothing this run and provenance exists from the next
      // one on. The alternative — deleting on missing provenance — is the bug
      // itself, and it lands hardest on first-run and just-upgraded users.
      const previousLock = await readLock(context.canonicalDir);
      await cleanupStaleGeneratedOutputs({
        projectRoot: context.rootBase,
        targets: activeTargets,
        expectedPaths: results.map((result) => result.path),
        scope,
        generatedOutputs: Object.keys(previousLock?.outputs ?? {}),
        inactiveTargets: configuredTargets.filter((t) => !activeTargets.includes(t)),
      });
      await writeLockFile(
        context,
        resolvedExtends,
        buildOutputChecksums(results),
        isFilteredRun(flags),
      );
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

export function buildSummary(results: Array<{ status: string }>): GenerateData['summary'] {
  return {
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    unchanged: results.filter((r) => r.status === 'unchanged').length,
  };
}
