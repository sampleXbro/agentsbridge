/**
 * The two global YAML files Continue owns with the user.
 *
 * `~/.continue/config.yaml` is the personal assistant config: `models` (with
 * provider and apiKey), `context`, `docs`, `data`, and the assistant's own
 * `name`. agentsmesh contributes `rules`, `prompts` and `mcpServers` and must
 * leave the rest — including `name` — exactly as the user wrote it.
 *
 * `~/.continue/permissions.yaml` is written by Continue itself every time the
 * user picks "always allow" / "always ask" / "exclude" for a tool. Ownership is
 * per bucket: canonical rewrites a bucket it has an opinion about, and the
 * buckets it says nothing about stay.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedYamlKeysMerger } from '../../core/generate/yaml-owned-keys.js';
import { CONTINUE_GLOBAL_CONFIG, CONTINUE_GLOBAL_PERMISSIONS } from './constants.js';

const mergeGlobalConfig = ownedYamlKeysMerger(
  [CONTINUE_GLOBAL_CONFIG],
  ['rules', 'prompts', 'mcpServers'],
);

const mergeGlobalPermissions = ownedYamlKeysMerger(
  [CONTINUE_GLOBAL_PERMISSIONS],
  ['allow', 'ask', 'exclude'],
);

export const mergeContinueGlobalYaml: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  mergeGlobalConfig(existing, pending, newContent, resolvedPath) ??
  mergeGlobalPermissions(existing, pending, newContent, resolvedPath);
