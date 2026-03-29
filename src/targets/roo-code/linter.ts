import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { ROO_CODE_TARGET } from './constants.js';

export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
): LintDiagnostic[] {
  return validateRules(canonical, projectRoot, projectFiles).map((diagnostic) => ({
    ...diagnostic,
    target: ROO_CODE_TARGET,
  }));
}
