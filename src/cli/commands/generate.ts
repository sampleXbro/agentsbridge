/**
 * agentsmesh generate — produce target files from canonical sources.
 */

import { join } from 'node:path';
import { loadScopedConfig } from '../../config/core/scope.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import {
  buildChecksums,
  buildExtendChecksums,
  buildPackChecksums,
  detectLockedFeatureViolations,
  readLock,
  writeLock,
} from '../../config/core/lock.js';
import { getCacheDir } from '../../config/remote/remote-fetcher.js';
import { generate as runEngine } from '../../core/generate/engine.js';
import { cleanupStaleGeneratedOutputs } from '../../core/generate/stale-cleanup.js';
import { ensureCacheSymlink, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import { getVersion } from '../version.js';
import { runMatrix } from './matrix.js';
import { ensurePathInsideRoot } from './generate-path.js';

interface RunGenerateOptions {
  printMatrix?: boolean;
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
    throw new Error('--features is no longer supported. Configure features in agentsmesh.yaml.');
  }

  const root = projectRoot ?? process.cwd();
  const checkOnly = flags.check === true;
  const dryRun = flags['dry-run'] === true;
  const force = flags.force === true;
  const scope = flags.global === true ? 'global' : 'project';
  const refreshRemoteCache = flags['refresh-cache'] === true || flags['no-cache'] === true;
  const targetStr = flags.targets;
  const targetFilter =
    typeof targetStr === 'string' && targetStr
      ? targetStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const { config, context } = await loadScopedConfig(root, scope);
  const lockFeatures = config.collaboration?.lock_features ?? [];
  if (config.collaboration?.strategy === 'lock' && !force && lockFeatures.length > 0) {
    const existingLock = await readLock(context.canonicalDir);
    if (existingLock !== null) {
      const currentChecksums = await buildChecksums(context.canonicalDir);
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
        logger.error("Run 'agentsmesh generate --force' to accept these changes.");
        throw new Error('Locked feature violation. Use --force to override.');
      }
    }
  }

  const { canonical, resolvedExtends } = await loadCanonicalWithExtends(
    config,
    context.configDir,
    {
      refreshRemoteCache,
    },
    context.canonicalDir,
  );
  const activeTargets = targetFilter
    ? config.targets.filter((t) => targetFilter.includes(t))
    : config.targets;

  const results = await runEngine({
    config,
    canonical,
    projectRoot: context.rootBase,
    scope,
    targetFilter,
  });

  if (results.length === 0) {
    logger.info('No files to generate (no root rule or rules feature disabled).');
    if (checkOnly) {
      logger.success('Generated files are in sync.');
      return 0;
    }
    if (!dryRun) {
      const checksums = await buildChecksums(context.canonicalDir);
      const extendChecksums =
        resolvedExtends.length > 0 ? await buildExtendChecksums(resolvedExtends) : {};
      const packChecksums = await buildPackChecksums(join(context.canonicalDir, 'packs'));
      const generatedBy = process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';
      await writeLock(context.canonicalDir, {
        generatedAt: new Date().toISOString(),
        generatedBy,
        libVersion: getVersion(),
        checksums,
        extends: extendChecksums,
        packs: packChecksums,
      });
      try {
        await ensureCacheSymlink(getCacheDir(), join(context.configDir, '.agentsmeshcache'));
      } catch (err) {
        logger.warn(
          `Could not create .agentsmeshcache symlink: ${err instanceof Error ? err.message : String(err)}`,
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
    logger.error("Generated files are out of sync. Run 'agentsmesh generate' to update them.");
    return 1;
  }

  for (const r of results) {
    if (dryRun) {
      logger.info(`[dry-run] ${r.status} ${r.path} (${r.target})`);
    } else if (r.status === 'created' || r.status === 'updated') {
      const fullPath = ensurePathInsideRoot(context.rootBase, r.path, r.target);
      await writeFileAtomic(fullPath, r.content);
      logger.success(`${r.status} ${r.path}`);
    }
  }

  if (!dryRun) {
    const created = results.filter((r) => r.status === 'created').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    const unchanged = results.filter((r) => r.status === 'unchanged').length;
    await cleanupStaleGeneratedOutputs({
      projectRoot: context.rootBase,
      targets: activeTargets,
      expectedPaths: results.map((result) => result.path),
      scope,
    });
    if (created > 0 || updated > 0) {
      logger.info(`Generated: ${created} created, ${updated} updated, ${unchanged} unchanged`);
    } else {
      logger.info(`Nothing changed. (${unchanged} unchanged)`);
    }

    const checksums = await buildChecksums(context.canonicalDir);
    const extendChecksums =
      resolvedExtends.length > 0 ? await buildExtendChecksums(resolvedExtends) : {};
    const packChecksums = await buildPackChecksums(join(context.canonicalDir, 'packs'));
    const generatedBy = process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';
    await writeLock(context.canonicalDir, {
      generatedAt: new Date().toISOString(),
      generatedBy,
      libVersion: getVersion(),
      checksums,
      extends: extendChecksums,
      packs: packChecksums,
    });
    try {
      await ensureCacheSymlink(getCacheDir(), join(context.configDir, '.agentsmeshcache'));
    } catch (err) {
      logger.warn(
        `Could not create .agentsmeshcache symlink: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (options.printMatrix !== false) {
    await runMatrix(flags, root);
  }

  return 0;
}
