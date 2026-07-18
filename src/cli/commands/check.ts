/**
 * agentsmesh check — CI integration for team collaboration.
 * Verifies canonical files and generated outputs are in sync.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { checkLockSync } from '../../core/check/lock-sync.js';
import { findStaleGeneratedOutputs } from '../../core/generate/stale-cleanup.js';
import { runGenerate } from './generate.js';
import type { CheckData } from '../command-result.js';

export interface CheckCommandResult {
  exitCode: number;
  data: CheckData;
}

/**
 * Run the check command.
 * @param flags - CLI flags
 * @param projectRoot - Project root (default process.cwd())
 * @returns Structured check result with exit code and data
 */
export async function runCheck(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<CheckCommandResult> {
  const root = projectRoot ?? process.cwd();
  const scope = flags.global === true ? 'global' : 'project';

  const { config, context } = await loadScopedConfig(root, scope);
  const report = await checkLockSync({
    config,
    configDir: context.configDir,
    canonicalDir: context.canonicalDir,
  });

  const outputCheck = report.hasLock
    ? await runGenerate({ ...flags, check: true, force: true }, root, { printMatrix: false })
    : null;
  const outputModified = [
    ...new Set(
      outputCheck?.data.files.filter((file) => file.status === 'updated').map((file) => file.path),
    ),
  ].sort();
  const outputRemoved = [
    ...new Set(
      outputCheck?.data.files.filter((file) => file.status === 'created').map((file) => file.path),
    ),
  ].sort();
  const outputStale = outputCheck
    ? await findStaleGeneratedOutputs({
        projectRoot: context.rootBase,
        targets: [...config.targets, ...config.pluginTargets],
        expectedPaths: outputCheck.data.files.map((file) => file.path),
        scope,
      })
    : [];
  const outputDrift = outputCheck?.exitCode === 1 || outputStale.length > 0;

  if (!report.hasLock) {
    return {
      exitCode: 1,
      data: {
        hasLock: false,
        canonicalDrift: false,
        outputDrift: false,
        inSync: false,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
        outputModified: [],
        outputRemoved: [],
        outputStale: [],
      },
    };
  }

  const inSync = report.inSync && !outputDrift;
  return {
    exitCode: inSync ? 0 : 1,
    data: {
      hasLock: true,
      canonicalDrift: !report.inSync,
      outputDrift,
      inSync,
      modified: [...report.modified],
      added: [...report.added],
      removed: [...report.removed],
      extendsModified: [...report.extendsModified],
      lockedViolations: [...report.lockedViolations],
      outputModified,
      outputRemoved,
      outputStale,
    },
  };
}
