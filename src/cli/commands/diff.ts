/**
 * agentsmesh diff — show what would change on the next generate.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { generate as runEngine } from '../../core/generate/engine.js';
import { computeDiff, formatDiffSummary } from '../../core/differ.js';
import { logger } from '../../utils/output/logger.js';

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
  const { canonical } = await loadCanonicalWithExtends(
    config,
    context.configDir,
    {},
    context.canonicalDir,
  );

  const results = await runEngine({
    config,
    canonical,
    projectRoot: context.rootBase,
    scope,
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
