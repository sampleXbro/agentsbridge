/**
 * Public API — canonical loading (package.json "exports"."./canonical").
 */

import type { CanonicalFiles } from '../core/types.js';
import { loadCanonicalFiles } from '../canonical/load/loader.js';

export { loadCanonicalFiles };

/** Load `.agentsmesh/` from a project root (or an explicit canonical directory). */
export async function loadCanonical(projectRoot: string): Promise<CanonicalFiles> {
  return loadCanonicalFiles(projectRoot);
}
