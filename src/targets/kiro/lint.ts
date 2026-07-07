/**
 * Kiro-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import {
  createUnsupportedHookWarning,
  unsupportedHookEventNames,
} from '../../core/lint/shared/helpers.js';

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const supported = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SubagentStop'] as const;
  return unsupportedHookEventNames(canonical.hooks, supported).map((event) =>
    createUnsupportedHookWarning(event, 'kiro', supported, { unsupportedBy: 'Kiro hooks' }),
  );
}
