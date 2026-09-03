/**
 * `managedOutputs` has two kinds of reader.
 *
 * `cleanupStaleGeneratedOutputs` is the only one that DELETES, so it reads
 * `files` alone — never `coOwnedFiles`, which holds shared user configs.
 *
 * Everyone else (reference rewriting, the import map, native install-path
 * picking) only needs to know which paths agentsmesh touches at all, and must
 * see both lists or a co-owned path silently drops out of their world. These
 * helpers are that "both lists" view; they take a layout, so they work the same
 * for a builtin descriptor and a registered plugin descriptor.
 */

import type { TargetLayout, TargetManagedOutputs } from './target-descriptor.js';

/** Every managed file: owned outright first, then co-owned. */
export function managedOutputFiles(managed: TargetManagedOutputs | undefined): readonly string[] {
  return [...(managed?.files ?? []), ...(managed?.coOwnedFiles ?? [])];
}

/** Every managed path of a layout: directories plus owned and co-owned files. */
export function managedOutputPaths(layout: TargetLayout | undefined): readonly string[] {
  return [...(layout?.managedOutputs?.dirs ?? []), ...managedOutputFiles(layout?.managedOutputs)];
}
