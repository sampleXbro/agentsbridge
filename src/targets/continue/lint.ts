/**
 * Continue-specific lint hooks.
 */

import type { CanonicalAgent, CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning, unsupportedHookEventNames } from '../../core/lint/shared/helpers.js';
import { CONTINUE_TARGET } from './constants.js';
import { CONTINUE_HOOK_EVENTS } from './hooks.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        CONTINUE_TARGET,
        'Continue invokable prompt rules do not natively enforce canonical allowed-tools metadata.',
      ),
    );
}

/**
 * Continue stores every event under one `hooks` key and only dispatches the
 * event names it knows; anything else sits in settings.json and never fires.
 */
export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  return unsupportedHookEventNames(canonical.hooks, CONTINUE_HOOK_EVENTS).map((event) =>
    createWarning(
      '.agentsmesh/hooks.yaml',
      CONTINUE_TARGET,
      `${event} is not a Continue hook event; it is written to .continue/settings.json but never fires.`,
    ),
  );
}

/** Canonical agent fields the Continue agent-file frontmatter schema has no concept of. */
const DROPPED_FIELDS: readonly (keyof CanonicalAgent)[] = [
  'disallowedTools',
  'permissionMode',
  'maxTurns',
  'mcpServers',
  'hooks',
  'skills',
  'memory',
];

function hasValue(agent: CanonicalAgent, field: keyof CanonicalAgent): boolean {
  const value = agent[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

/**
 * Warn per agent, naming exactly which canonical fields Continue ignores.
 * agentsmesh still writes them as inert frontmatter so import stays lossless —
 * what is lost is Continue acting on them. Scope-independent: one agent format.
 *
 * Wired as `generators.lint`, the only per-target lint hook that is not gated on
 * the `rules` feature. It fires whenever lint runs, including feature sets that
 * enable `agents` alone.
 */
export function lintAgents(canonical: CanonicalFiles): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  for (const agent of canonical.agents) {
    const dropped = DROPPED_FIELDS.filter((field) => hasValue(agent, field)).sort();
    if (dropped.length === 0) continue;
    diagnostics.push(
      createWarning(
        agent.source,
        CONTINUE_TARGET,
        '.continue/agents/<name>.md supports only name, description, model, tools, and the ' +
          `prompt; Continue ignores canonical ${dropped.join(', ')} ` +
          `(preserved on disk for round-trips, but never applied).`,
      ),
    );
  }
  return diagnostics;
}
