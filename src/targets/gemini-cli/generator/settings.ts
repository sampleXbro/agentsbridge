import type { CanonicalFiles } from '../../../core/types.js';
import { getHookCommand, hasHookCommand } from '../../../core/hook-command.js';
import { GEMINI_ROOT, GEMINI_COMPAT_AGENTS, GEMINI_SETTINGS } from '../constants.js';
import type { RulesOutput } from './types.js';

function mapHookEvent(event: string): string | null {
  switch (event) {
    case 'PreToolUse':
      return 'BeforeTool';
    case 'PostToolUse':
      return 'AfterTool';
    case 'Notification':
      return 'Notification';
    default:
      return null;
  }
}

/** Emits merged `.gemini/settings.json` when MCP, agents, or hooks contribute native settings. */
export function generateGeminiSettingsFiles(canonical: CanonicalFiles): RulesOutput[] {
  const settings: Record<string, unknown> = {};
  let hasAnyNativeSettings = false;

  if (canonical.mcp && Object.keys(canonical.mcp.mcpServers).length > 0) {
    settings.mcpServers = canonical.mcp.mcpServers;
    hasAnyNativeSettings = true;
  }
  if (canonical.agents.length > 0) {
    settings.experimental = { enableAgents: true };
    hasAnyNativeSettings = true;
  }
  if (canonical.hooks) {
    const hookEntries = Object.entries(canonical.hooks).flatMap(([event, entries]) => {
      const mappedEvent = mapHookEvent(event);
      if (!mappedEvent || !Array.isArray(entries)) return [];
      const mappedEntries = entries
        .filter(
          (entry): entry is NonNullable<typeof entry> =>
            typeof entry === 'object' && entry !== null && hasHookCommand(entry),
        )
        .map((entry, index) => ({
          matcher: entry!.matcher,
          hooks: [
            {
              name: `${mappedEvent}-${index + 1}`,
              type: 'command',
              command: getHookCommand(entry),
              timeout: entry!.timeout,
            },
          ],
        }));
      return mappedEntries.length > 0 ? [[mappedEvent, mappedEntries] as const] : [];
    });
    if (hookEntries.length > 0) {
      settings.hooks = Object.fromEntries(hookEntries);
      hasAnyNativeSettings = true;
    }
  }

  if (hasAnyNativeSettings) {
    settings.context = { fileName: [GEMINI_ROOT, GEMINI_COMPAT_AGENTS] };
  }

  if (Object.keys(settings).length === 0) return [];
  return [{ path: GEMINI_SETTINGS, content: JSON.stringify(settings, null, 2) }];
}
