/**
 * agentsmesh import — import config from a tool into canonical .agentsmesh/.
 */

import { relative } from 'node:path';
import { logger } from '../../utils/output/logger.js';
import { resolveScopeContext, loadScopedConfig } from '../../config/core/scope.js';
import {
  TARGET_IDS,
  getTargetCatalogEntry,
  isBuiltinTargetId,
} from '../../targets/catalog/target-catalog.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';

function formatImportResults(
  results: readonly { fromPath: string; toPath: string }[],
  rootBase: string,
  scope: string,
): void {
  for (const r of results) {
    const fromRel = relative(rootBase, r.fromPath);
    logger.success(`${fromRel} → ${r.toPath}`);
  }
  logger.info(
    `Imported ${results.length} file(s). Run 'agentsmesh generate${scope === 'global' ? ' --global' : ''}' to sync to other tools.`,
  );
}

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
  const scope = flags.global === true ? 'global' : 'project';

  if (isBuiltinTargetId(normalized)) {
    const context = resolveScopeContext(root, scope);
    const target = getTargetCatalogEntry(normalized);
    const results = await target.importFrom(context.rootBase, { scope });
    if (results.length === 0) {
      logger.info(target.emptyImportMessage);
      return;
    }
    formatImportResults(results, context.rootBase, scope);
    return;
  }

  let config;
  let context;
  try {
    ({ config, context } = await loadScopedConfig(root, scope));
  } catch {
    throw new Error(
      `Unknown --from "${from}" and no agentsmesh.yaml found. ` +
        `Run 'agentsmesh init' to enable plugin targets, or use a builtin: ${TARGET_IDS.join(', ')}.`,
    );
  }
  await bootstrapPlugins(config, root);

  const descriptor = getDescriptor(normalized);
  if (!descriptor) {
    throw new Error(
      `Unknown --from "${from}". Supported: ${[...TARGET_IDS, ...(config.pluginTargets ?? [])].join(', ')}.`,
    );
  }

  const results = await descriptor.generators.importFrom(context.rootBase, { scope });
  if (results.length === 0) {
    logger.info(descriptor.emptyImportMessage);
    return;
  }
  formatImportResults(results, context.rootBase, scope);
}
