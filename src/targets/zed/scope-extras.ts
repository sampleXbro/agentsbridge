/**
 * Revocation pass for Zed's `settings.json`.
 *
 * `emitScopedSettings` cannot read the disk, so it can only ADD keys — it has no
 * way to notice that yesterday's `context_servers` or `agent.tool_permissions`
 * are still there after the user emptied the canonical file. This hook can: it
 * reads the settings file, applies the owned-key overlay (which deletes claimed
 * keys with no canonical content) and emits the result only when something
 * actually changed.
 *
 * It runs before `generateScopedSettingsFeature`, so `emitScopedSettings` finds
 * this result as its pending output and merges onto it. Both use the same
 * overlay, so the two passes agree and the outcome is idempotent.
 *
 * What this hook emits is a PROJECTION, not a finished file: `{ key: null }` for
 * every claimed key with no canonical content. The engine folds it into the file
 * through `mergeZedSettings`, exactly like every other emission. Emitting the
 * merged file here instead would be folded a second time by the shared policy,
 * and an absent key means "not claimed" to that policy — the revoked key would
 * come straight back.
 *
 * `settings.json` deliberately stays out of `managedOutputs`: it is the user's
 * editor config (theme, formatters, language servers), and stale-cleanup deletes
 * every managed file a run did not emit.
 */

import { join } from 'node:path';
import type { GenerateResult } from '../../core/types.js';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  ZED_REVOCABLE_SETTINGS_KEYS,
  buildZedOwnedOverlay,
  parseZedSettings,
} from './settings-overlay.js';
import { ZED_TARGET, ZED_SETTINGS_FILE, ZED_GLOBAL_SETTINGS_FILE } from './constants.js';

export const zedScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
): Promise<GenerateResult[]> => {
  const path = scope === 'global' ? ZED_GLOBAL_SETTINGS_FILE : ZED_SETTINGS_FILE;
  const existing = await readFileSafe(join(projectRoot, path));
  if (existing === null) return [];

  const parsed = parseZedSettings(existing);
  if (parsed === null) return [];

  const overlay = buildZedOwnedOverlay(canonical, scope, enabledFeatures);
  const revoked = overlay.owned.filter(
    (key) =>
      ZED_REVOCABLE_SETTINGS_KEYS.includes(key) && !(key in overlay.present) && key in parsed,
  );
  if (revoked.length === 0) return [];

  const content = JSON.stringify(Object.fromEntries(revoked.map((key) => [key, null])), null, 2);

  return [
    {
      target: ZED_TARGET,
      path,
      content,
      currentContent: existing,
      status: 'updated',
    },
  ];
};
