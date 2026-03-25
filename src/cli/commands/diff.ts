/**
 * agentsbridge diff — show what would change on the next generate.
 */

import { loadConfigFromDir } from '../../config/loader.js';
import { loadCanonicalWithExtends } from '../../canonical/extends.js';
import { generate as runEngine } from '../../core/engine.js';
import { computeDiff, formatDiffSummary } from '../../core/differ.js';
import { logger } from '../../utils/logger.js';

/**
 * Run the diff command.
 * @param flags - CLI flags (targets)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runDiff(
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

  const results = await runEngine({
    config,
    canonical,
    projectRoot: configDir,
    targetFilter,
  });

  if (results.length === 0) {
    logger.info('No files to generate (no root rule or rules feature disabled).');
    return;
  }

  const { diffs, summary } = computeDiff(results);
  for (const d of diffs) {
    process.stdout.write(d.patch);
  }
  logger.info(formatDiffSummary(summary));
}
