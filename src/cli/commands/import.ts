/**
 * agentsmesh import — import config from a tool into canonical .agentsmesh/.
 */

import { relative } from 'node:path';
import { logger } from '../../utils/output/logger.js';
import { resolveScopeContext } from '../../config/core/scope.js';
import {
  TARGET_IDS,
  getTargetCatalogEntry,
  isBuiltinTargetId,
} from '../../targets/catalog/target-catalog.js';

/**
 * Run the import command.
 * @param flags - CLI flags (from)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runImport(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<void> {
  const root = projectRoot ?? process.cwd();
  const from = flags.from;
  if (typeof from !== 'string' || !from) {
    throw new Error('--from is required. Example: agentsmesh import --from claude-code');
  }
  const normalized = from.toLowerCase().trim();
  if (!isBuiltinTargetId(normalized)) {
    throw new Error(`Unknown --from "${from}". Supported: ${TARGET_IDS.join(', ')}.`);
  }
  const scope = flags.global === true ? 'global' : 'project';
  const context = resolveScopeContext(root, scope);

  const target = getTargetCatalogEntry(normalized);
  const results = await target.importFrom(context.rootBase, { scope });
  if (results.length === 0) {
    logger.info(target.emptyImportMessage);
    return;
  }
  for (const r of results) {
    const fromRel = relative(context.rootBase, r.fromPath);
    logger.success(`${fromRel} → ${r.toPath}`);
  }
  logger.info(
    `Imported ${results.length} file(s). Run 'agentsmesh generate${scope === 'global' ? ' --global' : ''}' to sync to other tools.`,
  );
}
