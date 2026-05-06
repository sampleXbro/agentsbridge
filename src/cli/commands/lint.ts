/**
 * agentsmesh lint — validate canonical files against target constraints.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { runLint } from '../../core/lint/linter.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import type { LintData } from '../command-result.js';

export interface LintCommandResult {
  exitCode: number;
  data: LintData;
}

/**
 * Run the lint command.
 * @param flags - CLI flags (targets, verbose)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Structured lint result with exit code and diagnostics data
 */
export async function runLintCmd(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<LintCommandResult> {
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

  const { diagnostics, hasErrors } = await runLint(
    config,
    canonical,
    context.configDir,
    targetFilter,
    { scope },
  );

  return {
    exitCode: hasErrors ? 1 : 0,
    data: {
      diagnostics: diagnostics.map((d) => ({
        level: d.level,
        file: d.file,
        target: d.target,
        message: d.message,
      })),
      summary: {
        errors: diagnostics.filter((d) => d.level === 'error').length,
        warnings: diagnostics.filter((d) => d.level === 'warning').length,
      },
    },
  };
}
