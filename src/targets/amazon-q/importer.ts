/**
 * Amazon Q Developer importer.
 *
 * Delegates to `runDescriptorImport` using the descriptor's `importer` spec, which
 * handles rules, commands, agents (directory) and MCP (mcpJson) declaratively. Ignore
 * patterns live inside the agent JSONs rather than in a file of their own, so they are
 * collected afterwards by `importAmazonQToolsSettings`.
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importAmazonQToolsSettings } from './import-tools-settings.js';
import { descriptor } from './index.js';

export async function importFromAmazonQ(
  projectRoot: string,
  options?: { scope?: TargetLayoutScope },
): Promise<ImportResult[]> {
  const scope = options?.scope ?? 'project';
  const results = await runDescriptorImport(descriptor, projectRoot, scope);
  await importAmazonQToolsSettings(projectRoot, scope, results);
  return results;
}
