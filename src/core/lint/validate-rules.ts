/**
 * Shared rules validation for lint. Used by target linters.
 */

import { relative } from 'node:path';
import type { CanonicalFiles, LintDiagnostic } from '../types.js';
import { globFilter } from '../../utils/text/glob.js';

/**
 * Validate rules and produce diagnostics (without target; caller adds target).
 * @param canonical - Loaded canonical files
 * @param projectRoot - Project root for relative paths
 * @param projectFiles - Relative file paths in project (for glob matching)
 * @returns Diagnostics for rules validation
 */
export function validateRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options: { checkGlobMatches?: boolean } = {},
): Omit<LintDiagnostic, 'target'>[] {
  const diags: Omit<LintDiagnostic, 'target'>[] = [];
  const { rules } = canonical;

  if (rules.length === 0) return [];

  const hasRoot = rules.some((r) => r.root);
  if (!hasRoot) {
    diags.push({
      level: 'error',
      file: relative(projectRoot, rules[0]!.source),
      message: 'Rules exist but no root rule (_root.md or root: true). Add a root rule.',
    });
  }

  if (options.checkGlobMatches === false) {
    return diags;
  }

  for (const rule of rules) {
    if (rule.globs.length === 0) continue;
    let anyMatch = false;
    for (const glob of rule.globs) {
      const matches = globFilter(projectFiles, glob);
      if (matches.length > 0) {
        anyMatch = true;
        break;
      }
    }
    if (!anyMatch) {
      diags.push({
        level: 'warning',
        file: relative(projectRoot, rule.source),
        message: `globs "${rule.globs.join(', ')}" match 0 files in project`,
      });
    }
  }

  return diags;
}
