import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/validate-rules.js';

const TARGET = 'continue';

export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
): LintDiagnostic[] {
  return validateRules(canonical, projectRoot, projectFiles).map((diagnostic) => ({
    ...diagnostic,
    target: TARGET,
  }));
}
