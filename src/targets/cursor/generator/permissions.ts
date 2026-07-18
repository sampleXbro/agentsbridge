import type { CanonicalFiles } from '../../../core/types.js';
import type { GenerateFeatureContext } from '../../catalog/target.interface.js';
import { CURSOR_CLI_JSON, CURSOR_GLOBAL_CLI_CONFIG } from '../constants.js';
import type { RulesOutput } from './types.js';

/**
 * Generate `.cursor/cli.json` (project) or `.cursor/cli-config.json` (global)
 * from canonical permissions.
 *
 * Cursor's CLI permissions format uses `{ permissions: { allow, deny } }`.
 * The `ask` category has no Cursor equivalent — items in `ask` are omitted
 * (Cursor's default behavior for unlisted tools is to prompt).
 *
 * Global scope uses a distinct filename: `~/.cursor/cli-config.json`.
 * Per https://cursor.com/docs/cli/reference/permissions the two paths are
 * `<project>/.cursor/cli.json` (project) and `~/.cursor/cli-config.json` (global).
 */
export function generatePermissions(
  canonical: CanonicalFiles,
  ctx?: GenerateFeatureContext,
): RulesOutput[] {
  if (!canonical.permissions) return [];
  const { allow, deny } = canonical.permissions;
  if (allow.length === 0 && deny.length === 0) return [];
  const permissions: Record<string, string[]> = {};
  if (allow.length > 0) permissions.allow = allow;
  if (deny.length > 0) permissions.deny = deny;
  const path = ctx?.scope === 'global' ? CURSOR_GLOBAL_CLI_CONFIG : CURSOR_CLI_JSON;
  return [{ path, content: JSON.stringify({ permissions }, null, 2) }];
}
