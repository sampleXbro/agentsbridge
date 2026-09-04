/**
 * `.codex/hooks.json` / `~/.codex/hooks.json` is hand-authored: Codex discovers
 * both paths but creates neither, and `/hooks` only reviews what is already
 * there (https://learn.chatgpt.com/docs/hooks). The document is
 * `{description?, hooks: {...}}`, and agentsmesh writes only the `hooks`
 * wrapper — so the top-level `description` used to be dropped on every run and
 * the file was deleted outright whenever canonical hooks went empty.
 *
 * One constant serves both scopes, so a single claim covers the twin.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedJsonKeysMerger } from '../../core/generate/json-owned-keys.js';
import { CODEX_HOOKS_FILE } from './constants.js';

export const mergeCodexHooksJson: GeneratedOutputMerger = ownedJsonKeysMerger(
  [CODEX_HOOKS_FILE],
  ['hooks'],
);
