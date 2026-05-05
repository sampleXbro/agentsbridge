/**
 * agentsmesh import — import config from a tool into canonical .agentsmesh/.
 */

import { relative } from 'node:path';
import { resolveScopeContext, loadScopedConfig } from '../../config/core/scope.js';
import {
  TARGET_IDS,
  getTargetCatalogEntry,
  isBuiltinTargetId,
} from '../../targets/catalog/target-catalog.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import type { ImportData } from '../command-result.js';

export interface ImportCommandResult {
  exitCode: number;
  data: ImportData;
}

function mapResults(
  results: readonly { fromPath: string; toPath: string }[],
  rootBase: string,
): Array<{ from: string; to: string }> {
  return results.map((r) => ({
    from: relative(rootBase, r.fromPath).replaceAll('\\', '/'),
    to: r.toPath,
  }));
}

/**
 * Run the import command.
 * @param flags - CLI flags (from)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Structured import result with exit code and file mapping data
 */
export async function runImport(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<ImportCommandResult> {
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
    return {
      exitCode: 0,
      data: {
        scope,
        target: normalized,
        files: mapResults(results, context.rootBase),
      },
    };
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
  return {
    exitCode: 0,
    data: {
      scope,
      target: normalized,
      files: mapResults(results, context.rootBase),
    },
  };
}
