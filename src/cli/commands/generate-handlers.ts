/**
 * Helper functions for the generate command.
 * Extracted from generate.ts to keep file sizes under 200 lines.
 */

import { join } from 'node:path';
import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { acquireProcessLock } from '../../utils/filesystem/process-lock.js';
import { cleanupStaleGeneratedOutputs } from '../../core/generate/stale-cleanup.js';
import { ensurePathInsideRoot } from './generate-path.js';
import { writeLockFile } from './generate-lock.js';
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
}

export async function handleEmptyResults(args: EmptyResultsArgs): Promise<GenerateCommandResult> {
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

export function buildSummary(results: Array<{ status: string }>): GenerateData['summary'] {
  return {
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    unchanged: results.filter((r) => r.status === 'unchanged').length,
  };
}
