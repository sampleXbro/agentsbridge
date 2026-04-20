/**
 * Kiro-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createUnsupportedHookWarning } from '../../core/lint/shared/helpers.js';

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const supported = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SubagentStop'] as const;
  const supportedSet = new Set(supported);
  return Object.keys(canonical.hooks)
    .filter((event) => !supportedSet.has(event as never))
    .map((event) =>
      createUnsupportedHookWarning(event, 'kiro', supported, { unsupportedBy: 'Kiro hooks' }),
    );
}
