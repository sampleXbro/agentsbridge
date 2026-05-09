/**
 * Amazon Q Developer importer.
 *
 * Delegates to `runDescriptorImport` using the descriptor's `importer` spec,
 * which handles both rules (directory) and MCP (mcpJson) declaratively.
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { descriptor } from './index.js';

export async function importFromAmazonQ(
  projectRoot: string,
  options?: { scope?: TargetLayoutScope },
): Promise<ImportResult[]> {
  const scope = options?.scope ?? 'project';
  return runDescriptorImport(descriptor, projectRoot, scope);
}
