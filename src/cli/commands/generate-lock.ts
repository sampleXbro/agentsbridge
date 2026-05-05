/**
 * Lock-file writing helper for the generate command.
 */

import { join } from 'node:path';
import {
  buildChecksums,
  buildExtendChecksums,
  buildPackChecksums,
  writeLock,
} from '../../config/core/lock.js';
import { getCacheDir } from '../../config/remote/remote-fetcher.js';
import { ensureCacheSymlink } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import { getVersion } from '../version.js';
import type { ResolvedExtend } from '../../config/resolve/resolver.js';

export async function writeLockFile(
  context: { canonicalDir: string; configDir: string },
  resolvedExtends: ResolvedExtend[],
): Promise<void> {
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
