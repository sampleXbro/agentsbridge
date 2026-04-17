export const SETTINGS_JSON_PATHS = ['.claude/settings.json', '.gemini/settings.json'];

export function mergeSettingsJson(existing: string, newContent: string): string {
  let base: Record<string, unknown>;
  try {
    const parsed = JSON.parse(existing) as Record<string, unknown>;
    base = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    base = {};
  }
  const incoming = JSON.parse(newContent) as Record<string, unknown>;
  const merged = { ...base };
  if (incoming.permissions !== undefined) merged.permissions = incoming.permissions;
  if (incoming.hooks !== undefined) merged.hooks = incoming.hooks;
  const perms = merged.permissions;
  if (perms && typeof perms === 'object' && !Array.isArray(perms) && !('ask' in perms)) {
    (perms as Record<string, unknown>).ask = [];
  }
  return JSON.stringify(merged, null, 2);
}

export function mergeGeminiSettingsJson(existing: string, newContent: string): string {
  let base: Record<string, unknown>;
  try {
    const parsed = JSON.parse(existing) as Record<string, unknown>;
    base = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    base = {};
  }
  const incoming = JSON.parse(newContent) as Record<string, unknown>;
  const merged = { ...base };
  if (incoming.mcpServers !== undefined) merged.mcpServers = incoming.mcpServers;
  if (incoming.hooks !== undefined) merged.hooks = incoming.hooks;
  if (incoming.experimental !== undefined) merged.experimental = incoming.experimental;
  if (incoming.context !== undefined) merged.context = incoming.context;
  return JSON.stringify(merged, null, 2);
}
