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

const CONFIG_FILENAME = 'agentsmesh.yaml';
const LOCAL_CONFIG_FILENAME = 'agentsmesh.local.yaml';
const GITIGNORE_ENTRIES = ['agentsmesh.local.yaml', '.agentsmeshcache', '.agentsmesh/.lock.tmp'];

/** Importers derived from target descriptors — no manual registration needed. */
const IMPORTERS: Record<string, (root: string) => Promise<ImportResult[]>> = Object.fromEntries(
  BUILTIN_TARGETS.map((d) => [d.id, (root: string) => d.generators.importFrom(root)]),
);

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
export async function runInit(projectRoot: string, options: { yes?: boolean } = {}): Promise<void> {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  if (await exists(configPath)) {
    throw new Error(`Already initialized. ${CONFIG_FILENAME} exists. Remove it first to re-init.`);
  }

  const existing = await detectExistingConfigs(projectRoot);

  if (existing.length > 0) {
    logger.info(`Found existing configurations: ${existing.join(', ')}`);

    if (options.yes) {
      logger.info('Auto-importing existing configurations (--yes)...');
      let totalImported = 0;
      for (const toolId of existing) {
        const importerFn = IMPORTERS[toolId];
        if (!importerFn) continue;
        const results = await importerFn(projectRoot);
        for (const r of results) {
          logger.success(`  ${r.fromPath.replace(projectRoot + '/', '')} → ${r.toPath}`);
        }
        totalImported += results.length;
      }
      if (totalImported > 0) {
        logger.info(`Imported ${totalImported} file(s) from ${existing.length} tool(s).`);
      }

      await writeScaffoldGapFill(projectRoot);

      await writeFileAtomic(configPath, buildConfig(existing));
      logger.success(`Created ${CONFIG_FILENAME} (targets: ${existing.join(', ')})`);
    } else {
      logger.info(
        `Run 'agentsmesh init --yes' to auto-import, or 'agentsmesh import --from <tool>' manually.`,
      );
      await writeScaffoldFull(projectRoot);
      await writeFileAtomic(configPath, buildConfig([]));
      logger.success(`Created ${CONFIG_FILENAME}`);
    }
  } else {
    await writeScaffoldFull(projectRoot);
    await writeFileAtomic(configPath, buildConfig([]));
    logger.success(`Created ${CONFIG_FILENAME}`);
  }

  const localPath = join(projectRoot, LOCAL_CONFIG_FILENAME);
  await writeFileAtomic(localPath, LOCAL_TEMPLATE);
  logger.success(`Created ${LOCAL_CONFIG_FILENAME}`);

  await appendToGitignore(projectRoot);
  logger.success('Updated .gitignore');
}
