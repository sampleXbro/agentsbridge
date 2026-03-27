/**
 * Cline target linter — validates canonical files for Cline.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { CLINE_TARGET } from './constants.js';

/**
 * Lint rules for Cline target.
 * @param canonical - Loaded canonical files
 * @param projectRoot - Project root (for relative paths)
 * @param projectFiles - Relative file paths for glob matching
 * @returns Diagnostics for this target
 */
export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
): LintDiagnostic[] {
  const diags = validateRules(canonical, projectRoot, projectFiles);
  return diags.map((d) => ({ ...d, target: CLINE_TARGET }));
}
