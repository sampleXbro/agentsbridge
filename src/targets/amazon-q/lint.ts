/**
 * Amazon Q Developer-specific lint hooks.
 *
 * Hooks (embedded): PreToolUse, PostToolUse, and UserPromptSubmit are embedded
 * into each agent JSON; Notification, SubagentStart, and SubagentStop have no
 * Amazon Q equivalent and emit warnings.
 *
 * Permissions (embedded): allow is embedded into each agent JSON as allowedTools;
 * deny and ask have no Amazon Q equivalent and emit a warning.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

/** Amazon Q canonical event names that are embeddable into agent JSON. */
const AQ_EMBEDDABLE_EVENTS: ReadonlySet<string> = new Set([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
]);

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks) return [];
  const unmappedEvents: string[] = [];
  for (const [event, entries] of Object.entries(canonical.hooks)) {
    if (!Array.isArray(entries) || entries.length === 0) continue;
    if (!AQ_EMBEDDABLE_EVENTS.has(event)) {
      unmappedEvents.push(event);
    }
  }
  if (unmappedEvents.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/hooks.yaml',
      'amazon-q',
      `Amazon Q CLI has no equivalent for hook event(s) ${unmappedEvents.join(', ')}; ` +
        'only PreToolUse, PostToolUse, and UserPromptSubmit are embedded in agent JSON.',
    ),
  ];
}

export function lintPermissions(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  const { deny } = canonical.permissions;
  const ask = canonical.permissions.ask ?? [];
  // allow maps cleanly to allowedTools in agent JSON — no warning needed.
  if (deny.length === 0 && ask.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'amazon-q',
      'Amazon Q CLI has no equivalent for permissions deny/ask lists; ' +
        'only allow is embedded in agent JSON as allowedTools.',
    ),
  ];
}
