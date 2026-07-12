/**
 * Amp-specific lint hooks.
 *
 * Amp has no dedicated ignore file and relies on .gitignore. Amp also has no
 * declarative settings-file hook mechanism (only the plugin-based `amp.on(...)`
 * event API, which is code agentsmesh cannot own) — see ampcode.com/manual.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'amp',
      'Amp has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks) return [];
  const hasEntries = Object.values(canonical.hooks).some(
    (entries) => Array.isArray(entries) && entries.length > 0,
  );
  if (!hasEntries) return [];
  return [
    createWarning(
      '.agentsmesh/hooks.yaml',
      'amp',
      'Amp has no settings-file hook mechanism (only the plugin-based amp.on(...) event API); canonical hooks are not projected.',
    ),
  ];
}
