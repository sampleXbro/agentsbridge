/**
 * AugmentCode-specific lint hooks.
 *
 * AugmentCode hooks live in `.augment/settings.json` and support
 * PreToolUse, PostToolUse, SessionStart, SessionEnd, and Stop events.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createUnsupportedHookWarning } from '../../core/lint/shared/helpers.js';

const SUPPORTED_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'SessionEnd',
  'Stop',
] as const;

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const supportedSet = new Set<string>(SUPPORTED_HOOK_EVENTS);
  return Object.keys(canonical.hooks)
    .filter((event) => !supportedSet.has(event))
    .map((event) =>
      createUnsupportedHookWarning(event, 'augment-code', SUPPORTED_HOOK_EVENTS, {
        unsupportedBy: 'AugmentCode hooks',
      }),
    );
}
