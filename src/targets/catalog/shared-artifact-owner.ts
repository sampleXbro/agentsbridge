/**
 * Resolve which builtin target owns a shared artifact prefix (reference rewriter, global skills).
 */

import { BUILTIN_TARGETS } from './builtin-targets.js';

export function ownerTargetIdForSharedPath(path: string): string | null {
  for (const descriptor of BUILTIN_TARGETS) {
    if (!descriptor.sharedArtifacts) continue;
    for (const [prefix, role] of Object.entries(descriptor.sharedArtifacts)) {
      if (role === 'owner' && path.startsWith(prefix)) {
        return descriptor.id;
      }
    }
  }
  return null;
}
