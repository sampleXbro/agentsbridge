/** Lint rules for the codebuff target. */
import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { createWarning } from '../../core/lint/shared/helpers.js';
import { nestedFilterConflicts } from './nested-rules.js';
import { CODEBUFF_TARGET } from './constants.js';

/**
 * `<dir>/AGENTS.md` is loaded by every AGENTS.md-reading tool, so a `targets:`
 * filter on a scoped rule cannot be enforced there. Silence would look like the
 * filter worked. Global scope embeds scoped rules into `~/.AGENTS.md` instead,
 * so it has no nested files and no conflict.
 */
function sharedNestedFileWarnings(canonical: CanonicalFiles): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  for (const conflict of nestedFilterConflicts(canonical)) {
    if (conflict.leaked.length > 0) {
      diagnostics.push(
        createWarning(
          conflict.path,
          CODEBUFF_TARGET,
          `Codebuff writes scoped rules to ${conflict.path}, which every AGENTS.md-reading tool loads, so the targets filter on these rules is advisory only: ${conflict.leaked.join(', ')}.`,
        ),
      );
    }
    if (conflict.contested.length > 0) {
      diagnostics.push(
        createWarning(
          conflict.path,
          CODEBUFF_TARGET,
          `These rules are targeted away from Codebuff but resolve to ${conflict.path}, which Codebuff also writes; only one version of that file can exist, so one tool's rules will be missing: ${conflict.contested.join(', ')}.`,
        ),
      );
    }
  }
  return diagnostics;
}

export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: 'project' | 'global' },
): LintDiagnostic[] {
  const global = options?.scope === 'global';
  return [
    ...validateRules(canonical, projectRoot, projectFiles, {
      checkGlobMatches: !global,
    }).map((diagnostic) => ({ ...diagnostic, target: CODEBUFF_TARGET })),
    ...(global ? [] : sharedNestedFileWarnings(canonical)),
  ];
}
