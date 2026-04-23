/**
 * agentsmesh lint — validate canonical files against target constraints.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { runLint } from '../../core/lint/linter.js';
import { logger } from '../../utils/output/logger.js';

/**
 * Run the lint command.
 * @param flags - CLI flags (targets, verbose)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Exit code: 1 if errors, 0 otherwise
 */
export async function runLintCmd(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<number> {
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

  const { diagnostics, hasErrors } = await runLint(
    config,
    canonical,
    context.configDir,
    targetFilter,
    { scope },
  );

  if (diagnostics.length === 0) {
    logger.success('All checks passed.');
    return 0;
  }

  const errors = diagnostics.filter((d) => d.level === 'error');
  const warnings = diagnostics.filter((d) => d.level === 'warning');

  if (errors.length > 0) {
    for (const d of errors) {
      logger.error(`${d.file} (${d.target}): ${d.message}`);
    }
  }
  if (warnings.length > 0) {
    for (const d of warnings) {
      logger.warn(`${d.file} (${d.target}): ${d.message}`);
    }
  }

  const errCount = errors.length;
  const warnCount = warnings.length;
  logger.info(
    `${errCount} error${errCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`,
  );

  return hasErrors ? 1 : 0;
}
