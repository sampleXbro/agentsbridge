/**
 * Claude Code target linter — validates canonical files for Claude Code.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { CLAUDE_CODE_TARGET } from './constants.js';

/**
 * Lint rules for Claude Code target.
 * @param canonical - Loaded canonical files
 * @param _projectRoot - Project root (for relative paths)
 * @param projectFiles - Relative file paths for glob matching
 * @returns Diagnostics for this target
 */
export function lintRules(
  canonical: CanonicalFiles,
  _projectRoot: string,
  projectFiles: string[],
): LintDiagnostic[] {
  const diags = validateRules(canonical, _projectRoot, projectFiles);
  return diags.map((d) => ({ ...d, target: CLAUDE_CODE_TARGET }));
}
