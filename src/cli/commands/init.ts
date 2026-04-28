/**
 * agentsmesh init — create agentsmesh.yaml and .agentsmesh/ scaffold.
 * With --yes: auto-import detected configs, then add example scaffold only where canonical paths stayed empty.
 */

import { join } from 'node:path';
import { exists, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import { BUILTIN_TARGETS } from '../../targets/catalog/builtin-targets.js';
import type { ImportResult } from '../../core/types.js';
import { buildConfig, LOCAL_TEMPLATE } from './init-templates.js';
import { detectExistingConfigs } from './init-detect.js';
import { writeScaffoldFull, writeScaffoldGapFill } from './init-scaffold.js';
import { resolveScopeContext, type ConfigScope } from '../../config/core/scope.js';
import type { BuiltinTargetId } from '../../targets/catalog/target-ids.js';

const CONFIG_FILENAME = 'agentsmesh.yaml';
const LOCAL_CONFIG_FILENAME = 'agentsmesh.local.yaml';
// Packs are materialized derivatives of installs.yaml — same model as node_modules.
// `agentsmesh install --sync` reproduces them deterministically post-clone.
// Generated target folders (.claude/, .cursor/, .github/, .gemini/, etc.) are NOT
// in this list — they are committed by default so fresh clones have AI configs
// available without a build step. Use `agentsmesh check` in CI to detect drift.
const GITIGNORE_ENTRIES = [
  'agentsmesh.local.yaml',
  '.agentsmeshcache',
  '.agentsmesh/.lock.tmp',
  '.agentsmesh/packs/',
];

/** Importers derived from target descriptors — no manual registration needed. */
const IMPORTERS: Record<string, (root: string, scope: ConfigScope) => Promise<ImportResult[]>> =
  Object.fromEntries(
    BUILTIN_TARGETS.map((d) => [
      d.id,
      (root: string, scope: ConfigScope) => d.generators.importFrom(root, { scope }),
    ]),
  );
const GLOBAL_INIT_TARGETS: BuiltinTargetId[] = BUILTIN_TARGETS.filter(
  (target) => target.globalSupport !== undefined,
).map((target) => target.id as BuiltinTargetId);

/**
 * Append entries to .gitignore if not already present.
 */
async function appendToGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = join(projectRoot, '.gitignore');
  const current = (await readFileSafe(gitignorePath)) ?? '';
  const lines = new Set(current.split('\n').map((s) => s.trim()));
  const toAdd = GITIGNORE_ENTRIES.filter((e) => !lines.has(e));
  if (toAdd.length === 0) return;
  const suffix = current.endsWith('\n') || current === '' ? '' : '\n';
  await writeFileAtomic(gitignorePath, current + suffix + toAdd.join('\n') + '\n');
}

export { detectExistingConfigs };

/**
 * Run the init command.
 * @param projectRoot - Project root (default process.cwd())
 * @param options - Optional flags: yes (auto-import without prompting)
 * @throws Error if already initialized
 */
export async function runInit(
  projectRoot: string,
  options: { yes?: boolean; global?: boolean } = {},
): Promise<void> {
  const scope: ConfigScope = options.global === true ? 'global' : 'project';
  const context = resolveScopeContext(projectRoot, scope);
  const configPath = join(context.configDir, CONFIG_FILENAME);
  if (await exists(configPath)) {
    throw new Error(`Already initialized. ${CONFIG_FILENAME} exists. Remove it first to re-init.`);
  }

  const detected = await detectExistingConfigs(context.rootBase, scope);
  const existing =
    scope === 'global'
      ? detected.filter((target): target is BuiltinTargetId =>
          GLOBAL_INIT_TARGETS.includes(target as BuiltinTargetId),
        )
      : detected;
  const defaultTargets = scope === 'global' ? GLOBAL_INIT_TARGETS : undefined;

  if (existing.length > 0) {
    logger.info(`Found existing configurations: ${existing.join(', ')}`);

    if (options.yes) {
      logger.info('Auto-importing existing configurations (--yes)...');
      let totalImported = 0;
      for (const toolId of existing) {
        const importerFn = IMPORTERS[toolId];
        if (!importerFn) continue;
        const results = await importerFn(context.rootBase, scope);
        for (const r of results) {
          logger.success(`  ${r.fromPath.replace(context.rootBase + '/', '')} → ${r.toPath}`);
        }
        totalImported += results.length;
      }
      if (totalImported > 0) {
        logger.info(`Imported ${totalImported} file(s) from ${existing.length} tool(s).`);
      }

      await writeScaffoldGapFill(context.canonicalDir);

      await writeFileAtomic(configPath, buildConfig(existing, defaultTargets));
      logger.success(`Created ${CONFIG_FILENAME} (targets: ${existing.join(', ')})`);
    } else {
      logger.info(
        `Run 'agentsmesh init --yes' to auto-import, or 'agentsmesh import --from <tool>' manually.`,
      );
      await writeScaffoldFull(context.canonicalDir);
      await writeFileAtomic(configPath, buildConfig([], defaultTargets));
      logger.success(`Created ${CONFIG_FILENAME}`);
    }
  } else {
    await writeScaffoldFull(context.canonicalDir);
    await writeFileAtomic(configPath, buildConfig([], defaultTargets));
    logger.success(`Created ${CONFIG_FILENAME}`);
  }

  const localPath = join(context.configDir, LOCAL_CONFIG_FILENAME);
  await writeFileAtomic(localPath, LOCAL_TEMPLATE);
  logger.success(`Created ${LOCAL_CONFIG_FILENAME}`);

  if (scope === 'project') {
    await appendToGitignore(projectRoot);
    logger.success('Updated .gitignore');
  }
}
