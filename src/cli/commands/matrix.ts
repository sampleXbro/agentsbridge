/**
 * agentsmesh matrix — show compatibility matrix for current config.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { buildCompatibilityMatrix, formatVerboseDetails } from '../../core/matrix/matrix.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import type { MatrixData } from '../command-result.js';

export interface MatrixCommandResult {
  exitCode: number;
  data: MatrixData;
  verboseDetails?: string;
}

/**
 * Run the matrix command.
 * @param flags - CLI flags (targets, verbose)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runMatrix(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<MatrixCommandResult> {
  const root = projectRoot ?? process.cwd();
  const scope = flags.global === true ? 'global' : 'project';
  const targetStr = flags.targets;
  const targetFilter =
    typeof targetStr === 'string' && targetStr
      ? targetStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const { config, context } = await loadScopedConfig(root, scope);
  await bootstrapPlugins(config, root);
  const { canonical } = await loadCanonicalWithExtends(
    config,
    context.configDir,
    {},
    context.canonicalDir,
  );

  const targets = targetFilter ?? [...config.targets, ...(config.pluginTargets ?? [])];
  const rows = buildCompatibilityMatrix(config, canonical, scope);
  const verboseDetails = formatVerboseDetails(canonical);

  return {
    exitCode: 0,
    data: {
      targets,
      features: rows.map((r) => ({ name: r.feature, support: r.support })),
    },
    verboseDetails: verboseDetails || undefined,
  };
}
