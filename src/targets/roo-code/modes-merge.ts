/**
 * Mode-scoped merge for `~/.roo/settings/custom_modes.yaml`.
 *
 * Roo Code writes this file itself every time the user creates a mode at Global
 * scope, so the list is shared. There is no key to scope ownership by, so it is
 * recorded in the file: a `# agentsmesh:` comment above every mode this tool
 * emits, the same convention `.aider.conf.yml` uses.
 *
 *   - a MARKED mode -> agentsmesh's, dropped and re-emitted from canonical,
 *     which is how an agent deleted from `.agentsmesh/agents/` loses its mode;
 *   - a mode whose slug canonical still owns -> also replaced, so a file written
 *     by an older agentsmesh (no markers) does not end up duplicated;
 *   - anything else -> the user's, kept verbatim.
 *
 * Within a replaced mode, fields agentsmesh does not write are carried over:
 * `whenToUse` and `customInstructions` are first-class Roo mode fields with no
 * canonical equivalent, and `iconName` / per-mode model bindings likewise.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { mergeMarkedYamlList } from '../../core/generate/yaml-list-merge.js';
import { ROO_CODE_GLOBAL_MODES_FILE, ROO_CODE_MODES_FILE } from './constants.js';

/** Written above every mode agentsmesh emits; its presence is the ownership proof. */
export const ROO_MODE_MARKER = ' agentsmesh: generated from .agentsmesh/agents/ — do not edit';

const SPEC = { listKey: 'customModes', idKey: 'slug', marker: ROO_MODE_MARKER };

/**
 * A new file is written through the same path so its modes carry the ownership
 * marker from the very first run — without it, the next run would read them back
 * as the user's and never revoke a deleted agent.
 *
 * @returns Merged YAML, or the base verbatim when it is not a YAML mapping
 */
export function mergeRooCustomModes(base: string | null, newContent: string): string {
  return mergeMarkedYamlList(base, newContent, SPEC);
}

/**
 * Both scopes, one merge: `.roomodes` is the project store Roo writes when the
 * user creates a mode at Project scope, and `custom_modes.yaml` is its Global
 * twin. Only one is ever resolved per run — the global layout suppresses
 * `.roomodes` (`layout.ts`) and emits the settings file from `scopeExtras`.
 */
export const mergeRooCustomModesYaml: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  resolvedPath === ROO_CODE_GLOBAL_MODES_FILE || resolvedPath === ROO_CODE_MODES_FILE
    ? mergeRooCustomModes(pending?.content ?? existing, newContent)
    : null;
