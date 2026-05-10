/**
 * Import Jules config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `AGENTS.md` — root rule
 *
 * Jules is a cloud-based async agent with no local skills,
 * MCP, or other file-based config beyond the root instruction file.
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { JULES_TARGET } from './constants.js';
import { descriptor } from './index.js';

export async function importFromJules(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const normalize = await createImportReferenceNormalizer(JULES_TARGET, projectRoot, scope);

  return runDescriptorImport(descriptor, projectRoot, scope, { normalize });
}
