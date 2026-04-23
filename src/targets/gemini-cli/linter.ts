/**
 * Gemini CLI target linter — validates canonical files for Gemini CLI.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { GEMINI_TARGET } from './constants.js';

/**
 * Lint rules for Gemini CLI target.
 * @param canonical - Loaded canonical files
 * @param projectRoot - Project root (for relative paths)
 * @param projectFiles - Relative file paths for glob matching
 * @returns Diagnostics for this target
 */
export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: 'project' | 'global' },
): LintDiagnostic[] {
  const diags = validateRules(canonical, projectRoot, projectFiles, {
    checkGlobMatches: options?.scope !== 'global',
  });
  return diags.map((d) => ({ ...d, target: GEMINI_TARGET }));
}
