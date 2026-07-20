/**
 * OpenCode-specific lint hooks.
 *
 * OpenCode hooks are plugin-based (TypeScript/JavaScript lifecycle events),
 * not config-based. agentsmesh cannot generate plugin code from canonical hooks.
 *
 * Ignore lives in `opencode.json` but is not generated from the canonical ignore file.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks) return [];
  const hasEntries = Object.values(canonical.hooks).some(
    (entries) => Array.isArray(entries) && entries.length > 0,
  );
  if (!hasEntries) return [];
  return [
    createWarning(
      '.agentsmesh/hooks.yaml',
      'opencode',
      'OpenCode hooks are supported via auto-loaded plugins at .opencode/plugins/; agentsmesh does not generate plugin files yet. Configure hooks manually.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'opencode',
      'opencode has no dedicated ignore file; canonical ignore patterns are not projected. Configure watcher.ignore in opencode.json manually.',
    ),
  ];
}
