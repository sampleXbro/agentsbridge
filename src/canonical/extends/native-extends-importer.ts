import type { ImportResult } from '../../core/result-types.js';
import { getDescriptor } from '../../targets/catalog/registry.js';

/**
 * Import native agent format files from repoPath into repoPath/.agentsmesh/.
 *
 * Dispatches to the descriptor's own `generators.importFrom`. Every builtin
 * target descriptor declares one (see `src/targets/<id>/index.ts`), so this
 * function works for any registered target — including plugin-registered
 * descriptors via `registerTargetDescriptor()`.
 *
 * @param repoPath - Absolute path to the fetched/cloned repo root
 * @param targetName - Detected target format identifier (e.g. 'claude-code')
 * @returns Import results from the descriptor's importer
 * @throws Error if no descriptor is registered for the given target name
 */
export async function importNativeToCanonical(
  repoPath: string,
  targetName: string,
): Promise<ImportResult[]> {
  const descriptor = getDescriptor(targetName);
  if (!descriptor) {
    throw new Error(`No importer registered for native target: ${targetName}`);
  }
  return descriptor.generators.importFrom(repoPath);
}
