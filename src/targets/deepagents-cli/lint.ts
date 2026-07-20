/**
 * Deep Agents CLI-specific lint functions.
 *
 * Deep Agents CLI does not support permissions or ignore as standalone
 * project config files. Commands are projected as skills via
 * supportsConversion. Agents are natively supported via
 * `.deepagents/agents/{name}/AGENTS.md`. Hooks have no project-level surface
 * at all (only global `~/.deepagents/hooks.json` — see `global-hooks.ts`).
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createWarning } from '../../core/lint/shared/helpers.js';
import { unmappedDeepagentsHookEvents } from './hooks-format.js';

export function lintPermissions(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  const { allow, deny } = canonical.permissions;
  const ask = canonical.permissions.ask ?? [];
  if (allow.length === 0 && deny.length === 0 && ask.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'deepagents-cli',
      'Deep Agents CLI permissions are partially supported via DEEPAGENTS_CODE_SHELL_ALLOW_LIST in .env; agentsmesh does not generate permissions config.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'deepagents-cli',
      'Deep Agents CLI has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}

/**
 * Deep Agents CLI has no project-level hooks surface at all, so project scope
 * always warns when any canonical hooks exist. Global scope has a real
 * surface (`~/.deepagents/hooks.json`) but only supports a handful of
 * lifecycle events, so it warns only about the specific events with no
 * Deep Agents equivalent (dropped on generate — see `hooks-format.ts`).
 */
export function lintHooks(canonical: CanonicalFiles, options?: unknown): LintDiagnostic[] {
  const scope = (options as { scope?: TargetLayoutScope } | undefined)?.scope;
  if (!canonical.hooks) return [];
  if (scope !== 'global') {
    const hasEntries = Object.values(canonical.hooks).some(
      (entries) => Array.isArray(entries) && entries.length > 0,
    );
    if (!hasEntries) return [];
    return [
      createWarning(
        '.agentsmesh/hooks.yaml',
        'deepagents-cli',
        'Deep Agents CLI has no project-level hooks surface (only global ~/.deepagents/hooks.json, docs.langchain.com/oss/javascript/deepagents/code/hooks); canonical hooks are not projected for the project.',
      ),
    ];
  }
  const unmapped = unmappedDeepagentsHookEvents(canonical.hooks);
  if (unmapped.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/hooks.yaml',
      'deepagents-cli',
      `Deep Agents CLI has no equivalent for hook event(s) ${unmapped.join(', ')}; they are not projected to ~/.deepagents/hooks.json.`,
    ),
  ];
}
