import type { CanonicalFiles } from '../../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../../core/hook-command.js';
import { CURSOR_HOOKS } from '../constants.js';
import type { RulesOutput } from './types.js';

function toCursorHooks(hooks: import('../../../core/types.js').Hooks): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const translated: Array<{ matcher: string; hooks: unknown[] }> = [];
    for (const e of entries) {
      if (!hasHookText(e)) continue;
      const command = getHookCommand(e);
      const prompt = getHookPrompt(e);
      const value = e.type === 'prompt' ? prompt || command : command || prompt;
      const hookItem: Record<string, unknown> = {
        type: e.type === 'prompt' ? 'prompt' : 'command',
        [e.type === 'prompt' ? 'prompt' : 'command']: value,
      };
      if (e.timeout !== undefined) hookItem.timeout = e.timeout;
      translated.push({ matcher: e.matcher, hooks: [hookItem] });
    }
    if (translated.length > 0) result[event] = translated;
  }
  return result;
}

export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const cursorHooks = toCursorHooks(canonical.hooks);
  if (Object.keys(cursorHooks).length === 0) return [];
  const content = JSON.stringify({ version: 1, hooks: cursorHooks }, null, 2);
  return [{ path: CURSOR_HOOKS, content }];
}
