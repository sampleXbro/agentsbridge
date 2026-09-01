import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { CONTINUE_TARGET } from './constants.js';

/**
 * Rule diagnostics only. Agent diagnostics live on `generators.lint` (see
 * `lint.ts`): riding along here gated them on the `rules` feature, so a config
 * with `agents` but no `rules` generated agent files and warned about nothing.
 */
export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: 'project' | 'global' },
): LintDiagnostic[] {
  return validateRules(canonical, projectRoot, projectFiles, {
    checkGlobMatches: options?.scope !== 'global',
  }).map((diagnostic) => ({ ...diagnostic, target: CONTINUE_TARGET }));
}
