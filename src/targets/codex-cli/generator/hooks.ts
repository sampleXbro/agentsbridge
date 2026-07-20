import type { CanonicalFiles } from '../../../core/types.js';
import { buildWrappedCommandHooks } from '../../import/wrapped-command-hooks.js';
import { CODEX_HOOKS_FILE, CODEX_SUPPORTED_HOOK_EVENTS } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  return buildWrappedCommandHooks(canonical, CODEX_HOOKS_FILE, {
    supportedEvents: CODEX_SUPPORTED_HOOK_EVENTS,
  });
}
