/**
 * Discover canonical resources at a content root (install / validate).
 */

import type { ExtendPick } from '../config/schema.js';
import type { CanonicalFiles } from '../core/types.js';
import { loadCanonicalSliceAtPath, normalizeSlicePath } from '../canonical/load-canonical-slice.js';

/** Feature keys present in a canonical snapshot (install / extends). */
export function featuresFromCanonical(c: CanonicalFiles): string[] {
  const f: string[] = [];
  if (c.skills.length) f.push('skills');
  if (c.rules.length) f.push('rules');
  if (c.commands.length) f.push('commands');
  if (c.agents.length) f.push('agents');
  if (c.mcp !== null) f.push('mcp');
  if (c.permissions !== null) f.push('permissions');
  if (c.hooks !== null) f.push('hooks');
  if (c.ignore.length) f.push('ignore');
  return f;
}

/**
 * Resolve file vs directory, then load canonical slice (rules/commands/agents/skills / .agentsbridge).
 */
export async function discoverFromContentRoot(contentRoot: string): Promise<{
  canonical: CanonicalFiles;
  features: string[];
  implicitPick?: ExtendPick;
}> {
  const { sliceRoot, implicitPick } = await normalizeSlicePath(contentRoot);
  const canonical = await loadCanonicalSliceAtPath(sliceRoot);
  return {
    canonical,
    features: featuresFromCanonical(canonical),
    implicitPick,
  };
}
