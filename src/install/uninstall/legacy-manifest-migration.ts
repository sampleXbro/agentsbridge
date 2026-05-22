/**
 * Auto-generate a baseline `.agentsmesh-install-manifest.json` for packs that
 * predate per-file integrity tracking.
 *
 * Before this manifest existed, packs were installed with only `pack.yaml`
 * (provenance + aggregate `content_hash`) and no per-file hash map. Uninstall
 * needs the map to detect post-install modifications; this helper backfills
 * it from the pack's current on-disk state and writes the manifest in place.
 *
 * Important semantics:
 *   - We assume the legacy pack is pristine. Modifications made between
 *     install and migration are silently absorbed into the new baseline.
 *     The warn callback advertises this so the caller can surface it to the
 *     user (the install plan calls this out at `--force` as well).
 *   - `name`, `source`, and `installed_at` are recovered from `pack.yaml`,
 *     which every pre-change pack writes (per the install pipeline). If
 *     `pack.yaml` is missing or unparseable we cannot synthesize provenance
 *     and throw rather than write a bogus manifest.
 *   - When a manifest already exists, this is a no-op; we never overwrite a
 *     real install-time manifest with a current-state baseline.
 *
 * Pure-ish: writes one file (the manifest) and invokes the injected `warn`
 * once on the migration path. Otherwise stateless.
 */

import { join } from 'node:path';
import { exists, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { INSTALL_MANIFEST_FILENAME, hashPackFiles } from '../manifest/install-manifest-hash.js';
import { readPackMetadata } from '../pack/pack-reader.js';

export interface LegacyMigrationDeps {
  warn(message: string): void;
  /**
   * When true, compute the baseline hash map but DO NOT persist the manifest
   * to disk. Used by `--dry-run uninstall` so previewing never mutates state.
   */
  readonly dryRun?: boolean;
}

export interface BaselineInstallManifest {
  readonly name: string;
  readonly source: string;
  readonly installed_at: string;
  readonly extends_id: null;
  readonly source_type: null;
  readonly files: Record<string, string>;
}

export interface LegacyMigrationResult {
  readonly manifest: BaselineInstallManifest;
  readonly manifestPath: string;
}

/**
 * Generate and persist a baseline install manifest for a legacy pack.
 *
 * @param packDir - Absolute path to the pack directory.
 * @param deps - Injected diagnostics surface.
 * @returns The new manifest + its path, or `null` when no migration is needed.
 * @throws When `pack.yaml` is missing or invalid (cannot recover provenance).
 */
export async function migrateLegacyManifest(
  packDir: string,
  deps: LegacyMigrationDeps,
): Promise<LegacyMigrationResult | null> {
  const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
  if (await exists(manifestPath)) return null;

  const meta = await readPackMetadata(packDir);
  if (meta === null) {
    throw new Error(
      `Cannot migrate legacy pack at ${packDir}: pack.yaml is missing or invalid; cannot recover install provenance.`,
    );
  }

  const files = await hashPackFiles(packDir);
  const manifest: BaselineInstallManifest = {
    name: meta.name,
    source: meta.source,
    installed_at: meta.installed_at,
    extends_id: null,
    source_type: null,
    files,
  };

  if (deps.dryRun !== true) {
    await writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  deps.warn(
    `Legacy pack "${meta.name}" detected; generated baseline install manifest from current contents. Local modifications since install cannot be detected.`,
  );

  return { manifest, manifestPath };
}
