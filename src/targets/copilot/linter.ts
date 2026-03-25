/**
 * Copilot target linter — validates canonical files for GitHub Copilot.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/validate-rules.js';

const TARGET = 'copilot';

/**
 * Lint rules for Copilot target.
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
  const targetDiags = diags.map((d) => ({ ...d, target: TARGET }));
  const nonRootWithoutGlobs = canonical.rules.filter(
    (rule) => !rule.root && rule.globs.length === 0,
  );
  return [
    ...targetDiags,
    ...nonRootWithoutGlobs.map((rule) => ({
      level: 'warning' as const,
      file: rule.source,
      target: TARGET,
      message:
        'Copilot path-specific instructions require applyTo globs; non-root rules without globs are not generated.',
    })),
  ];
}
