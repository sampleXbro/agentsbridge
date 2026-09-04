/**
 * Build and merge AugmentCode `settings.json` content from canonical files.
 *
 * settings.json carries `mcpServers`, `hooks`, and `toolPermissions`. Augment
 * documents the same `toolPermissions` shape in the personal
 * `~/.augment/settings.json` and in the repo-level `.augment/settings.json`
 * that teams commit to enforce policy, so it is emitted at both scopes.
 * Repo-level permissions are honored by the Auggie CLI and Cosmos cloud
 * agents; the IDE extension ignores them.
 * https://docs.augmentcode.com/cli/permissions
 */

import type { CanonicalFiles, Permissions } from '../../core/types.js';
import type { Hooks } from '../../core/hook-types.js';

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

  if (enabledFeatures.has('permissions')) {
    const toolPermissions = serializeToolPermissions(canonical.permissions);
    if (toolPermissions) settings.toolPermissions = toolPermissions;
  }

  if (Object.keys(settings).length === 0) return null;
  return JSON.stringify(settings, null, 2);
}

/**
 * Overlay the keys agentsmesh manages onto `base`.
 *
 * `base` is the pending write from an earlier pass of the same run when there
 * is one, otherwise the on-disk file — several features share this one file,
 * so each pass must build on the previous one instead of the stale disk copy.
 */
export function mergeAugmentSettings(base: string | null, newContent: string): string {
  if (base === null) return newContent;
  let merged: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(base);
    merged =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    merged = {};
  }
  const incoming: unknown = JSON.parse(newContent);
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) return base;
  const overlay = incoming as Record<string, unknown>;
  if (overlay.mcpServers !== undefined) merged.mcpServers = overlay.mcpServers;
  if (overlay.hooks !== undefined) merged.hooks = overlay.hooks;
  if (overlay.toolPermissions !== undefined) merged.toolPermissions = overlay.toolPermissions;
  return JSON.stringify(merged, null, 2);
}
