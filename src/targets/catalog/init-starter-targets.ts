/**
 * Default targets for `agentsmesh init` starter scaffold.
 *
 * Iterates `BUILTIN_TARGETS` and excludes any descriptor that opts out via
 * `excludeFromStarterInit: true`. Used so a new target ships into the default
 * starter list automatically; targets with structural incompatibilities (e.g.
 * codex-cli's `AGENTS.md` collision with other AGENTS.md-first tools) declare
 * the exclusion on their own descriptor.
 */

import { BUILTIN_TARGETS } from './builtin-targets.js';
import { type BuiltinTargetId, isBuiltinTargetId } from './target-ids.js';

export function starterInitTargetIds(): readonly BuiltinTargetId[] {
  return BUILTIN_TARGETS.filter((d) => !d.excludeFromStarterInit)
    .map((d) => d.id)
    .filter(isBuiltinTargetId);
}

/**
 * Targets eligible for global (`--global`) init — those whose descriptor declares
 * a `globalSupport` layout. Single source for both the non-interactive global
 * default set and the interactive global wizard's selectable options.
 */
export function globalInitTargetIds(): readonly BuiltinTargetId[] {
  return BUILTIN_TARGETS.filter((d) => d.globalSupport !== undefined)
    .map((d) => d.id)
    .filter(isBuiltinTargetId);
}
