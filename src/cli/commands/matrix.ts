/**
 * agentsmesh matrix — show compatibility matrix for current config.
 */

import { loadConfigFromDir } from '../../config/loader.js';
import { loadCanonicalWithExtends } from '../../canonical/extends.js';
import { buildCompatibilityMatrix, formatMatrix, formatVerboseDetails } from '../../core/matrix.js';
import { logger } from '../../utils/logger.js';

/**
 * Run the matrix command.
 * @param flags - CLI flags (targets, verbose)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runMatrix(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<void> {
  const root = projectRoot ?? process.cwd();
  const targetStr = flags.targets;
  const targetFilter =
    typeof targetStr === 'string' && targetStr
      ? targetStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const { config, configDir } = await loadConfigFromDir(root);
  const { canonical } = await loadCanonicalWithExtends(config, configDir);

  const targets = targetFilter ?? config.targets;
  const rows = buildCompatibilityMatrix(config, canonical);

  if (rows.length === 0) {
    logger.info('No features enabled. Enable features in agentsmesh.yaml.');
    return;
  }

  const table = formatMatrix(rows, targets);
  process.stdout.write(table);
  process.stdout.write('\n');

  if (flags.verbose === true) {
    const details = formatVerboseDetails(canonical);
    if (details) {
      process.stdout.write(details);
      process.stdout.write('\n');
    }
  }
}
