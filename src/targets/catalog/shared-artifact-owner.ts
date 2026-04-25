/**
 * Resolve which builtin target owns a shared artifact prefix (reference rewriter, global skills).
 */

import type { TargetDescriptor } from './target-descriptor.js';
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

interface OwnerEntry {
  readonly targetId: string;
  readonly prefix: string;
}

/**
 * Validate that no two descriptors claim ownership of the same or overlapping
 * shared-artifact prefixes. Two prefixes overlap when one is a prefix of the
 * other (e.g. `.agents/` and `.agents/skills/` would collide). Identical
 * prefixes always collide.
 *
 * Returns the list of conflicts; empty when ownership is unambiguous.
 */
export function findSharedArtifactOwnershipConflicts(
  descriptors: readonly TargetDescriptor[],
): readonly { readonly a: OwnerEntry; readonly b: OwnerEntry }[] {
  const owners: OwnerEntry[] = [];
  for (const descriptor of descriptors) {
    if (!descriptor.sharedArtifacts) continue;
    for (const [prefix, role] of Object.entries(descriptor.sharedArtifacts)) {
      if (role !== 'owner') continue;
      owners.push({ targetId: descriptor.id, prefix });
    }
  }

  const conflicts: { a: OwnerEntry; b: OwnerEntry }[] = [];
  for (let i = 0; i < owners.length; i++) {
    for (let j = i + 1; j < owners.length; j++) {
      const a = owners[i];
      const b = owners[j];
      if (a === undefined || b === undefined) continue;
      if (a.prefix === b.prefix || a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix)) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

/**
 * Throws if descriptors disagree about who owns a shared-artifact prefix.
 * Called once at module load against `BUILTIN_TARGETS` to fail fast on a
 * misconfiguration that would otherwise silently depend on iteration order
 * inside the reference rewriter.
 */
export function assertSharedArtifactOwnersUnique(descriptors: readonly TargetDescriptor[]): void {
  const conflicts = findSharedArtifactOwnershipConflicts(descriptors);
  if (conflicts.length === 0) return;

  const lines = conflicts.map(
    ({ a, b }) => `  - "${a.targetId}" owns "${a.prefix}" and "${b.targetId}" owns "${b.prefix}"`,
  );
  throw new Error(
    `Shared-artifact ownership conflict: two targets claim the same or overlapping prefix.\n` +
      lines.join('\n') +
      `\nResolve by changing one target's role to 'consumer' or by namespacing its prefix.`,
  );
}
