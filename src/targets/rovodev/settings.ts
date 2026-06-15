/**
 * Rovo Dev global settings helpers.
 *
 * Builds and merges `~/.rovodev/config.yml` which holds both
 * `eventHooks` and `toolPermissions` for global scope.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { ROVODEV_GLOBAL_CONFIG_FILE } from './constants.js';

type SettingsOutput = readonly { readonly path: string; readonly content: string }[];

export function buildRovodevConfig(
  canonical: CanonicalFiles,
  enabledFeatures: ReadonlySet<string>,
): SettingsOutput {
  const config: Record<string, unknown> = {};

  if (enabledFeatures.has('hooks') && canonical.hooks) {
    const hasEntries = Object.values(canonical.hooks).some(
      (entries) => Array.isArray(entries) && entries.length > 0,
    );
    if (hasEntries) {
      config.eventHooks = canonical.hooks;
    }
  }

  if (enabledFeatures.has('permissions') && canonical.permissions) {
    const { allow, deny } = canonical.permissions;
    const ask = canonical.permissions.ask ?? [];
    if (allow.length > 0 || deny.length > 0 || ask.length > 0) {
      config.toolPermissions = {
        allow: allow.length > 0 ? allow : undefined,
        deny: deny.length > 0 ? deny : undefined,
        ask: ask.length > 0 ? ask : undefined,
      };
    }
  }

  if (Object.keys(config).length === 0) return [];
  return [{ path: ROVODEV_GLOBAL_CONFIG_FILE, content: yamlStringify(config) }];
}

export function mergeRovodevConfig(
  existing: string | null,
  newContent: string,
): string {
  if (existing === null) return newContent;
  let base: Record<string, unknown>;
  try {
    const parsed: unknown = yamlParse(existing);
    base =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    base = {};
  }
  const incoming: unknown = yamlParse(newContent);
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming))
    return existing;
  const overlay = incoming as Record<string, unknown>;
  if (overlay.eventHooks !== undefined) base.eventHooks = overlay.eventHooks;
  if (overlay.toolPermissions !== undefined) base.toolPermissions = overlay.toolPermissions;
  return yamlStringify(base);
}
