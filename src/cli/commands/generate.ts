/**
 * agentsbridge generate — produce target files from canonical sources.
 */

import { join, resolve, sep } from 'node:path';
import { loadConfigFromDir } from '../../config/loader.js';
import { loadCanonicalWithExtends } from '../../canonical/extends.js';
import {
  buildChecksums,
  buildExtendChecksums,
  buildPackChecksums,
  detectLockedFeatureViolations,
  readLock,
  writeLock,
} from '../../config/lock.js';
import { getCacheDir } from '../../config/remote-fetcher.js';
import { generate as runEngine } from '../../core/engine.js';
import { ensureCacheSymlink, writeFileAtomic } from '../../utils/fs.js';
import { logger } from '../../utils/logger.js';
import { getVersion } from '../version.js';
import { runMatrix } from './matrix.js';

interface RunGenerateOptions {
  printMatrix?: boolean;
}

export function ensurePathInsideRoot(
  rootDir: string,
  relativePath: string,
  target: string,
): string {
  const rootAbs = resolve(rootDir);
  const outputAbs = resolve(rootDir, relativePath);
  if (outputAbs === rootAbs || outputAbs.startsWith(`${rootAbs}${sep}`)) return outputAbs;
  throw new Error(`Unsafe generated output path for ${target}: ${relativePath}`);
}

/**
 * Run the generate command.
 * @param flags - CLI flags (targets, dry-run, verbose)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runGenerate(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
  options: RunGenerateOptions = {},
): Promise<number> {
  if (flags.features !== undefined) {
    throw new Error('--features is no longer supported. Configure features in agentsbridge.yaml.');
  }

  const root = projectRoot ?? process.cwd();
  const checkOnly = flags.check === true;
  const dryRun = flags['dry-run'] === true;
  const force = flags.force === true;
  const refreshRemoteCache = flags['refresh-cache'] === true || flags['no-cache'] === true;
  const targetStr = flags.targets;
  const targetFilter =
    typeof targetStr === 'string' && targetStr
      ? targetStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const { config, configDir } = await loadConfigFromDir(root);
  const lockFeatures = config.collaboration?.lock_features ?? [];
  if (config.collaboration?.strategy === 'lock' && !force && lockFeatures.length > 0) {
    const abDir = join(configDir, '.agentsbridge');
    const existingLock = await readLock(abDir);
    if (existingLock !== null) {
      const currentChecksums = await buildChecksums(abDir);
      const violations = detectLockedFeatureViolations(
        existingLock.checksums,
        currentChecksums,
        lockFeatures,
      );
      if (violations.length > 0) {
        logger.error('Locked feature violation (strategy: lock). Modified files:');
        for (const violation of violations) {
          logger.error(`  ${violation}`);
        }
        logger.error("Run 'agentsbridge generate --force' to accept these changes.");
        throw new Error('Locked feature violation. Use --force to override.');
      }
    }
  }

  const { canonical, resolvedExtends } = await loadCanonicalWithExtends(config, configDir, {
    refreshRemoteCache,
  });

  const results = await runEngine({
    config,
    canonical,
    projectRoot: configDir,
    targetFilter,
  });

  if (results.length === 0) {
    logger.info('No files to generate (no root rule or rules feature disabled).');
    if (checkOnly) {
      logger.success('Generated files are in sync.');
      return 0;
    }
    if (!dryRun) {
      const abDir = join(configDir, '.agentsbridge');
      const checksums = await buildChecksums(abDir);
      const extendChecksums =
        resolvedExtends.length > 0 ? await buildExtendChecksums(resolvedExtends) : {};
      const packChecksums = await buildPackChecksums(join(abDir, 'packs'));
      const generatedBy = process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';
      await writeLock(abDir, {
        generatedAt: new Date().toISOString(),
        generatedBy,
        libVersion: getVersion(),
        checksums,
        extends: extendChecksums,
        packs: packChecksums,
      });
      try {
        await ensureCacheSymlink(getCacheDir(), join(configDir, '.agentsbridgecache'));
      } catch (err) {
        logger.warn(
          `Could not create .agentsbridgecache symlink: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (options.printMatrix !== false) {
      await runMatrix(flags, root);
    }
    return 0;
  }

  if (checkOnly) {
    const drifted = results.filter((r) => r.status !== 'unchanged');
    if (drifted.length === 0) {
      logger.success('Generated files are in sync.');
      return 0;
    }
    for (const r of drifted) {
      logger.error(`[check] ${r.status} ${r.path} (${r.target})`);
    }
    logger.error("Generated files are out of sync. Run 'agentsbridge generate' to update them.");
    return 1;
  }

  for (const r of results) {
    if (dryRun) {
      logger.info(`[dry-run] ${r.status} ${r.path} (${r.target})`);
    } else if (r.status === 'created' || r.status === 'updated') {
      const fullPath = ensurePathInsideRoot(configDir, r.path, r.target);
      await writeFileAtomic(fullPath, r.content);
      logger.success(`${r.status} ${r.path}`);
    }
  }

  if (!dryRun) {
    const created = results.filter((r) => r.status === 'created').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    const unchanged = results.filter((r) => r.status === 'unchanged').length;
    if (created > 0 || updated > 0) {
      logger.info(`Generated: ${created} created, ${updated} updated, ${unchanged} unchanged`);
    } else {
      logger.info(`Nothing changed. (${unchanged} unchanged)`);
    }

    const abDir = join(configDir, '.agentsbridge');
    const checksums = await buildChecksums(abDir);
    const extendChecksums =
      resolvedExtends.length > 0 ? await buildExtendChecksums(resolvedExtends) : {};
    const packChecksums = await buildPackChecksums(join(abDir, 'packs'));
    const generatedBy = process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';
    await writeLock(abDir, {
      generatedAt: new Date().toISOString(),
      generatedBy,
      libVersion: getVersion(),
      checksums,
      extends: extendChecksums,
      packs: packChecksums,
    });
    try {
      await ensureCacheSymlink(getCacheDir(), join(configDir, '.agentsbridgecache'));
    } catch (err) {
      logger.warn(
        `Could not create .agentsbridgecache symlink: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (options.printMatrix !== false) {
    await runMatrix(flags, root);
  }

  return 0;
}
