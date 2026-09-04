/**
 * Emission of `globalSupport.scopeExtras` results.
 *
 * scopeExtras is one of three emission paths in `generate`, and the only one
 * that used to push its results into the run untouched. A generator that builds
 * its content from canonical alone therefore replaced the user's own tool config
 * wholesale — the same defect that had already been fixed for `generateFeature`
 * and for the permissions/hooks/scoped-settings passes.
 *
 * So extras land here instead, through the same three steps `emitGeneratedOutput`
 * uses: read what is on disk, fold the new content in with `mergeOutputContent`,
 * and replace any pending result for the same path. Status and `currentContent`
 * are recomputed from the merged value, never trusted from the generator — a
 * generator that reads the file itself cannot know what an earlier pass in the
 * same run already wrote.
 *
 * A generator that merges internally stays correct because the policy is a
 * no-op unless the descriptor claims the path (or it is a `SETTINGS_JSON_PATHS`
 * file), and a descriptor that claims a path its own extras writes must make the
 * merge idempotent — see `tests/unit/core/generate/scope-extras-merge.test.ts`.
 */

import { join } from 'node:path';
import type { GenerateResult } from '../types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { computeStatus } from './feature-loop.js';
import { mergeOutputContent } from './merge-policy.js';

/**
 * Fold one target's scopeExtras output into the run.
 *
 * @param results - Results collected so far; mutated in place
 * @param target - Target id, used when an extra omits `target` (plugin descriptors do)
 * @param extras - Raw scopeExtras output
 * @param projectRoot - Root the paths are relative to
 */
export async function emitScopeExtras(
  results: GenerateResult[],
  target: string,
  extras: readonly GenerateResult[],
  projectRoot: string,
): Promise<void> {
  for (const extra of extras) {
    const extraTarget = extra.target ?? target;
    const existing = await readFileSafe(join(projectRoot, extra.path));
    const pendingIdx = results.findIndex((r) => r.path === extra.path && r.target === extraTarget);
    const pending = pendingIdx >= 0 ? results[pendingIdx] : undefined;
    const content = mergeOutputContent(extraTarget, existing, pending, extra.content, extra.path);
    if (pendingIdx >= 0) results.splice(pendingIdx, 1);
    results.push({
      target: extraTarget,
      path: extra.path,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    });
  }
}
