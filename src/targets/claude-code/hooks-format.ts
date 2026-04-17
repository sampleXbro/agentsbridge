/**
 * Shared Claude Code hooks serialization (settings.json vs hooks.json).
 */

import type { CanonicalFiles } from '../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../core/hook-command.js';

/**
 * Build Claude Code native hooks object from canonical hooks.
 * Shape: { event: [{ matcher, hooks: [{ type, command|prompt, timeout? }] }] }
 */
export function buildClaudeHooksObjectFromCanonical(
  canonical: CanonicalFiles,
): Record<string, unknown> {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return {};
  const result: Record<string, unknown> = {};
  for (const [event, entries] of Object.entries(canonical.hooks)) {
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
