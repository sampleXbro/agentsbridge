/**
 * `prompts.yml` is Rovo Dev's saved-prompt manifest. The user authors prompts in
 * it (the importer at `importer.ts:39` reads them back), and agentsmesh writes
 * canonical commands into the same list, so ownership is per entry rather than
 * per file — the marker convention in `yaml-list-merge.ts`.
 *
 * Both scopes are claimed here: `.rovodev/prompts.yml` and its `~` twin are
 * distinct constants, and claiming only one would leave the other on whole-file
 * replacement.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { mergeMarkedYamlList } from '../../core/generate/yaml-list-merge.js';
import { ROVODEV_PROMPTS_FILE, ROVODEV_GLOBAL_PROMPTS_FILE } from './constants.js';

/** Written above every prompt agentsmesh emits; its presence is the ownership proof. */
export const ROVODEV_PROMPT_MARKER =
  ' agentsmesh: generated from .agentsmesh/commands/ — do not edit';

const SPEC = { listKey: 'prompts', idKey: 'name', marker: ROVODEV_PROMPT_MARKER };

export const mergeRovodevPromptsYaml: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  resolvedPath === ROVODEV_PROMPTS_FILE || resolvedPath === ROVODEV_GLOBAL_PROMPTS_FILE
    ? mergeMarkedYamlList(pending?.content ?? existing, newContent, SPEC)
    : null;
