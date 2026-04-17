/**
 * Reinstall missing local packs from the persisted install manifest.
 */

import { join } from 'node:path';
import { exists } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import { readInstallManifest, type InstallManifestEntry } from '../core/install-manifest.js';

export async function syncInstalledPacks(args: {
  canonicalDir: string;
  reinstall: (entry: InstallManifestEntry) => Promise<void>;
}): Promise<void> {
  const installs = await readInstallManifest(args.canonicalDir);
  if (installs.length === 0) {
    logger.info('No recorded installs found in .agentsmesh/installs.yaml.');
    return;
  }

  const missing = [];
  for (const entry of installs) {
    const packDir = join(args.canonicalDir, 'packs', entry.name);
    if (!(await exists(packDir))) {
      missing.push(entry);
    }
  }

  if (missing.length === 0) {
    logger.info('All recorded packs are already installed.');
    return;
  }

  for (const entry of missing) {
    await args.reinstall(entry);
  }
  logger.success(`Reinstalled ${missing.length} pack(s) from .agentsmesh/installs.yaml.`);
}

export async function maybeRunInstallSync(args: {
  sync: boolean;
  canonicalDir: string;
  reinstall: (entry: InstallManifestEntry) => Promise<void>;
}): Promise<boolean> {
  if (!args.sync) return false;
  await syncInstalledPacks({ canonicalDir: args.canonicalDir, reinstall: args.reinstall });
  return true;
}
