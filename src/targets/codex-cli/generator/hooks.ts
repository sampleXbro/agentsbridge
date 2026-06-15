import type { CanonicalFiles } from '../../../core/types.js';
import { getHookCommand, hasHookCommand } from '../../../core/hook-command.js';
import { CODEX_HOOKS_FILE } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks) return [];
  const hooks: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(canonical.hooks)) {
    if (!Array.isArray(entries)) continue;
    const mapped = entries.flatMap((entry) => {
      if (!hasHookCommand(entry) || entry.type === 'prompt') return [];
      const hook: Record<string, unknown> = {
        type: 'command',
        command: getHookCommand(entry),
      };
      if (entry.timeout !== undefined) hook.timeout = entry.timeout;
      return [{ matcher: entry.matcher, hooks: [hook] }];
    });
    if (mapped.length > 0) hooks[event] = mapped;
  }
  if (Object.keys(hooks).length === 0) return [];
  return [{ path: CODEX_HOOKS_FILE, content: JSON.stringify({ hooks }, null, 2) }];
}
