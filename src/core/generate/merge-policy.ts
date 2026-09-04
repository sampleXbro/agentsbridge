/**
 * Shared merge policy for every generated output.
 *
 * Targets whose output lands in a file the user also owns (a shared tool config)
 * declare `mergeGeneratedOutputContent` on their descriptor; the policy consults
 * it first and falls back to whole-file replacement when the descriptor declines
 * the path. Resolution is `getBuiltinTargetDefinition(id) ?? getDescriptor(id)`
 * so a registered plugin descriptor gets exactly the same treatment.
 */

import type { GenerateResult } from '../types.js';
import { getBuiltinTargetDefinition } from '../../targets/catalog/builtin-targets.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import { SETTINGS_JSON_PATHS, mergeSettingsJson } from './settings.js';

export type OutputContentMerger = (
  existing: string | null,
  pending: GenerateResult | undefined,
  newContent: string,
  resolvedPath: string,
) => string;

export interface OutputMergeOptions {
  readonly mergeContent?: OutputContentMerger;
}

export function mergeOutputContent(
  target: string,
  existing: string | null,
  pending: GenerateResult | undefined,
  newContent: string,
  resolvedPath: string,
): string {
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  const merged = descriptor?.mergeGeneratedOutputContent?.(
    existing,
    pending,
    newContent,
    resolvedPath,
  );
  if (merged !== null && merged !== undefined) return merged;
  const base = pending?.content ?? existing;
  return base !== null && SETTINGS_JSON_PATHS.includes(resolvedPath)
    ? mergeSettingsJson(base, newContent)
    : newContent;
}

/** Emission options binding the shared policy to one target. */
export function outputMergeOptions(target: string): OutputMergeOptions {
  return {
    mergeContent: (existing, pending, newContent, resolvedPath) =>
      mergeOutputContent(target, existing, pending, newContent, resolvedPath),
  };
}
