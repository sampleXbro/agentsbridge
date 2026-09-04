/**
 * `emitScopedSettings` + `mergeGeneratedOutputContent` for Zed's `settings.json`.
 *
 * The emitter writes only the keys that carry canonical content, so a project
 * with nothing to say never gets a settings file. Clearing an owned key that the
 * user has since emptied is the job of `scope-extras.ts`, which can read the file.
 *
 * The merge base is `pending?.content ?? existing` because three features land on
 * this one path in a single generate pass; using `existing` would make whichever
 * feature runs last erase the earlier ones.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { GeneratedOutputMerger, TargetLayoutScope } from '../catalog/target-descriptor.js';
import {
  ZED_OWNED_SETTINGS_KEYS,
  applyZedOwnedSettingsKey,
  buildZedOwnedOverlay,
  parseZedSettings,
} from './settings-overlay.js';
import { ZED_SETTINGS_FILE, ZED_GLOBAL_SETTINGS_FILE } from './constants.js';

export interface ZedScopedSettingsOutput {
  readonly path: string;
  readonly content: string;
}

export function emitZedScopedSettings(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly ZedScopedSettingsOutput[] {
  const { present } = buildZedOwnedOverlay(canonical, scope, enabledFeatures);
  if (Object.keys(present).length === 0) return [];
  // The global layout rewrites this path; emitting one path keeps the scopes aligned.
  return [{ path: ZED_SETTINGS_FILE, content: JSON.stringify(present, null, 2) }];
}

/** Apply an emitted overlay onto the merge base, key by key. */
export const mergeZedSettings: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== ZED_SETTINGS_FILE && resolvedPath !== ZED_GLOBAL_SETTINGS_FILE) return null;

  const base = pending?.content ?? existing;
  if (base === null) return newContent;

  const merged = parseZedSettings(base);
  const overlay = parseZedSettings(newContent);
  // A JSONC file (or any non-object) is left exactly as the user wrote it —
  // rewriting it as strict JSON would silently delete their comments.
  if (merged === null || overlay === null) return base;
  for (const key of ZED_OWNED_SETTINGS_KEYS) {
    if (!(key in overlay)) continue;
    // An explicit `null` is the revocation marker `scope-extras.ts` emits: the
    // key is claimed but has no canonical content, so it must be removed rather
    // than left at its previous value. An absent key is simply not claimed.
    const desired = overlay[key];
    applyZedOwnedSettingsKey(merged, key, desired === null ? undefined : desired);
  }
  return JSON.stringify(merged, null, 2);
};
