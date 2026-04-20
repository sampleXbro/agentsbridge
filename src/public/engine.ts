/**
 * Public API — generation and import (see package.json "exports"."./engine").
 * Stability: follow semver for these symbols; internal modules are not supported.
 */

export { generate, resolveOutputCollisions } from '../core/generate/engine.js';
export type { GenerateContext } from '../core/generate/engine.js';
export type { GenerateResult, ImportResult } from '../core/types.js';
import type { ImportResult } from '../core/types.js';
import { getTargetCatalogEntry } from '../targets/catalog/target-catalog.js';
import type { BuiltinTargetId } from '../targets/catalog/target-ids.js';

export async function importFrom(
  target: BuiltinTargetId,
  opts: { root: string; scope?: 'project' | 'global' },
): Promise<ImportResult[]> {
  return getTargetCatalogEntry(target).importFrom(opts.root, { scope: opts.scope ?? 'project' });
}
