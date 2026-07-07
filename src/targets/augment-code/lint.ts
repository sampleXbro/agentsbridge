/**
 * AugmentCode-specific lint hooks.
 *
 * AugmentCode hooks live in `.augment/settings.json` and support
 * PreToolUse, PostToolUse, SessionStart, SessionEnd, and Stop events.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import {
  createUnsupportedHookWarning,
  unsupportedHookEventNames,
} from '../../core/lint/shared/helpers.js';

const SUPPORTED_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'SessionEnd',
  'Stop',
] as const;

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  return unsupportedHookEventNames(canonical.hooks, SUPPORTED_HOOK_EVENTS).map((event) =>
    createUnsupportedHookWarning(event, 'augment-code', SUPPORTED_HOOK_EVENTS, {
      unsupportedBy: 'AugmentCode hooks',
    }),
  );
}
