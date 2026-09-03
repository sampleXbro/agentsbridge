/**
 * Merge helper for `.vscode/settings.json`.
 *
 * The file is a shared VS Code workspace settings file other tooling may also
 * write to. Merge in only the two Roo Code command-permission keys, keeping
 * every other existing key untouched (read-modify-write, never overwrite).
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { preservedUnparsableBase } from '../../core/generate/json-owned-keys.js';
import {
  ROO_CODE_VSCODE_SETTINGS,
  ROO_CODE_ALLOWED_COMMANDS_KEY,
  ROO_CODE_DENIED_COMMANDS_KEY,
} from './constants.js';

export const mergeRooCodeSettings: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== ROO_CODE_VSCODE_SETTINGS) return null;
  const base = pending?.content ?? existing;
  if (base === null) return newContent;
  // VS Code ships this file commented, and JSONC is its documented format.
  const preserved = preservedUnparsableBase(base);
  if (preserved !== null) return preserved;

  const parsedBase = JSON.parse(base) as Record<string, unknown>;

  let incoming: unknown;
  try {
    incoming = JSON.parse(newContent);
  } catch {
    return base;
  }
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) return base;
  const overlay = incoming as Record<string, unknown>;
  if (overlay[ROO_CODE_ALLOWED_COMMANDS_KEY] !== undefined) {
    parsedBase[ROO_CODE_ALLOWED_COMMANDS_KEY] = overlay[ROO_CODE_ALLOWED_COMMANDS_KEY];
  }
  if (overlay[ROO_CODE_DENIED_COMMANDS_KEY] !== undefined) {
    parsedBase[ROO_CODE_DENIED_COMMANDS_KEY] = overlay[ROO_CODE_DENIED_COMMANDS_KEY];
  }
  return JSON.stringify(parsedBase, null, 2);
};
