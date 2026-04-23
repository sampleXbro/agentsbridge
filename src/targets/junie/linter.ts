import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { JUNIE_TARGET } from './constants.js';

export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: 'project' | 'global' },
): LintDiagnostic[] {
  return validateRules(canonical, projectRoot, projectFiles, {
    checkGlobMatches: options?.scope !== 'global',
  }).map((diagnostic) => ({
    ...diagnostic,
    target: JUNIE_TARGET,
  }));
}
