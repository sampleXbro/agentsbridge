/**
 * Revocation for Pi permissions, wired as `globalSupport.scopeExtras`.
 *
 * `generatePermissions` only runs off canonical content, so it cannot see the
 * case that matters here: `.agentsmesh/permissions.yaml` was DELETED (or became
 * unreadable, which `parsePermissions` reports the same way) or emptied, while
 * `.pi/settings.json` still carries the `defaultTools` array a previous run
 * wrote. Left alone, that stale allow-list applies forever — the file is
 * deliberately not in `managedOutputs`, so stale cleanup will never touch it.
 *
 * scopeExtras is the only generate-time hook that gets `projectRoot`, so the
 * clean-up lives here. It runs at BOTH scopes (the engine does not gate the
 * hook) and picks the settings file for the scope it is given. It stands down
 * whenever canonical still has permissions, because the feature loop has
 * already written the file in that case.
 */

import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { computeStatus } from '../../core/generate/feature-loop.js';
import {
  hasPermissionEntries,
  mergePiSettings,
  parseDefaultTools,
  OWNED_PI_TOOLS,
} from './permissions-format.js';
import {
  PI_AGENT_TARGET,
  PI_AGENT_SETTINGS_FILE,
  PI_AGENT_GLOBAL_SETTINGS_FILE,
} from './constants.js';

export async function revokePiAgentPermissions(
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): Promise<GenerateResult[]> {
  if (hasPermissionEntries(canonical.permissions) || !enabledFeatures.has('permissions')) return [];

  const path = scope === 'global' ? PI_AGENT_GLOBAL_SETTINGS_FILE : PI_AGENT_SETTINGS_FILE;
  const existing = await readFileSafe(join(projectRoot, path));
  if (existing === null) return [];

  // Nothing of agentsmesh's in the file: leave it byte-for-byte alone rather
  // than re-serialising the user's formatting for no reason.
  const tools = parseDefaultTools(existing);
  if (tools === null || !tools.some((tool) => OWNED_PI_TOOLS.has(tool))) return [];

  // An empty overlay means "strip what agentsmesh owns".
  const content = mergePiSettings(existing, '{}');

  return [
    {
      target: PI_AGENT_TARGET,
      path,
      content,
      currentContent: existing,
      status: computeStatus(existing, content),
    },
  ];
}
