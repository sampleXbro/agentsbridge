/**
 * Build and merge AugmentCode `settings.json` content from canonical files.
 *
 * settings.json carries `mcpServers`, `hooks`, and (global scope only)
 * `toolPermissions`. Permissions live exclusively in the personal
 * `~/.augment/settings.json` and are read only by the Auggie CLI, so they are
 * emitted at global scope only.
 */

import type { CanonicalFiles, Permissions } from '../../core/types.js';
import type { Hooks } from '../../core/hook-types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';

interface ToolPermissionEntry {
  toolName: string;
  permission: { type: 'allow' | 'deny' | 'ask-user' };
}

function serializeHooksForSettings(hooks: Hooks): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!entries || entries.length === 0) continue;
    result[event] = entries.map((entry) => ({
      matcher: entry.matcher,
      hooks: [
        {
          type: 'command',
          command: entry.command,
          ...(entry.timeout !== undefined ? { timeout: entry.timeout } : {}),
        },
      ],
    }));
  }
  return result;
}

export function serializeToolPermissions(
  permissions: Permissions | null,
): ToolPermissionEntry[] | undefined {
  if (!permissions) return undefined;
  const entries: ToolPermissionEntry[] = [];
  for (const toolName of permissions.allow ?? []) {
    entries.push({ toolName, permission: { type: 'allow' } });
  }
  for (const toolName of permissions.deny ?? []) {
    entries.push({ toolName, permission: { type: 'deny' } });
  }
  for (const toolName of permissions.ask ?? []) {
    entries.push({ toolName, permission: { type: 'ask-user' } });
  }
  return entries.length > 0 ? entries : undefined;
}

export function buildSettingsContent(
  canonical: CanonicalFiles,
  enabledFeatures: ReadonlySet<string>,
  scope: TargetLayoutScope,
): string | null {
  const settings: Record<string, unknown> = {};

  if (
    enabledFeatures.has('mcp') &&
    canonical.mcp &&
    Object.keys(canonical.mcp.mcpServers).length > 0
  ) {
    settings.mcpServers = canonical.mcp.mcpServers;
  }

  if (enabledFeatures.has('hooks') && canonical.hooks && Object.keys(canonical.hooks).length > 0) {
    settings.hooks = serializeHooksForSettings(canonical.hooks);
  }

  if (scope === 'global' && enabledFeatures.has('permissions')) {
    const toolPermissions = serializeToolPermissions(canonical.permissions);
    if (toolPermissions) settings.toolPermissions = toolPermissions;
  }

  if (Object.keys(settings).length === 0) return null;
  return JSON.stringify(settings, null, 2);
}

export function mergeAugmentSettings(existing: string | null, newContent: string): string {
  if (existing === null) return newContent;
  let base: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(existing);
    base =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    base = {};
  }
  const incoming: unknown = JSON.parse(newContent);
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) return existing;
  const overlay = incoming as Record<string, unknown>;
  if (overlay.mcpServers !== undefined) base.mcpServers = overlay.mcpServers;
  if (overlay.hooks !== undefined) base.hooks = overlay.hooks;
  if (overlay.toolPermissions !== undefined) base.toolPermissions = overlay.toolPermissions;
  return JSON.stringify(base, null, 2);
}
