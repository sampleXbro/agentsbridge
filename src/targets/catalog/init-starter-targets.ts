/**
 * Default targets for `agentsmesh init` starter scaffold.
 * Codex is excluded because its AGENTS.md index collides with other AGENTS.md-first targets.
 */

import { TARGET_IDS, type BuiltinTargetId } from './target-ids.js';

const STARTER_EXCLUDED_IDS: readonly BuiltinTargetId[] = ['codex-cli'];

export function starterInitTargetIds(): readonly BuiltinTargetId[] {
  return TARGET_IDS.filter((id) => !STARTER_EXCLUDED_IDS.includes(id));
}
