/**
 * Import Zed config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `.rules`              — root rule
 *   - `.zed/settings.json`  — MCP servers (context_servers key)
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importZedMcp } from './mcp-import.js';
import { ZED_TARGET, ZED_SETTINGS_FILE, ZED_GLOBAL_SETTINGS_FILE } from './constants.js';
import { descriptor } from './index.js';

export async function importFromZed(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(ZED_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const mcpFile = scope === 'global' ? ZED_GLOBAL_SETTINGS_FILE : ZED_SETTINGS_FILE;
  await importZedMcp(projectRoot, mcpFile, results);

  return results;
}
