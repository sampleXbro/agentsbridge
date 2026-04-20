import type { CanonicalFiles } from '../../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../../core/hook-command.js';
import { WINDSURF_HOOKS_FILE } from '../constants.js';
import type { RulesOutput } from './types.js';

function windsurfEventName(event: string): string {
  const explicit: Record<string, string> = {
    PreToolUse: 'pre_tool_use',
    PostToolUse: 'post_tool_use',
    Notification: 'notification',
    UserPromptSubmit: 'user_prompt_submit',
    SubagentStart: 'subagent_start',
    SubagentStop: 'subagent_stop',
  };
  if (explicit[event]) return explicit[event];
  return event
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toWindsurfHooks(hooks: import('../../../core/types.js').Hooks): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const translated: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (!hasHookText(entry)) continue;
      const command = getHookCommand(entry);
      const prompt = getHookPrompt(entry);
      const value = entry.type === 'prompt' ? prompt || command : command || prompt;
      if (!value) continue;
      translated.push({ command: value, show_output: true });
    }
    if (translated.length > 0) result[windsurfEventName(event)] = translated;
  }
  return result;
}

export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const hooks = toWindsurfHooks(canonical.hooks);
  if (Object.keys(hooks).length === 0) return [];
  return [{ path: WINDSURF_HOOKS_FILE, content: JSON.stringify({ hooks }, null, 2) }];
}
