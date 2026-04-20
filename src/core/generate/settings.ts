import { z } from 'zod';

export const SETTINGS_JSON_PATHS = ['.claude/settings.json', '.gemini/settings.json'];

const claudeIncomingSchema = z
  .object({
    permissions: z
      .object({ allow: z.array(z.string()).optional(), deny: z.array(z.string()).optional() })
      .passthrough()
      .optional(),
    hooks: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const geminiIncomingSchema = z
  .object({
    mcpServers: z.record(z.string(), z.unknown()).optional(),
    hooks: z.record(z.string(), z.unknown()).optional(),
    experimental: z.record(z.string(), z.unknown()).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function mergeSettingsJson(existing: string, newContent: string): string {
  const base = parseJsonObject(existing);
  const incoming = claudeIncomingSchema.parse(JSON.parse(newContent));
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
  const base = parseJsonObject(existing);
  const incoming = geminiIncomingSchema.parse(JSON.parse(newContent));
  const merged = { ...base };
  if (incoming.mcpServers !== undefined) merged.mcpServers = incoming.mcpServers;
  if (incoming.hooks !== undefined) merged.hooks = incoming.hooks;
  if (incoming.experimental !== undefined) merged.experimental = incoming.experimental;
  if (incoming.context !== undefined) merged.context = incoming.context;
  return JSON.stringify(merged, null, 2);
}
