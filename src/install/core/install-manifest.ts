/**
 * Persist install provenance so packs can be re-synced after local deletion.
 */

import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';
import {
  installManifestEntrySchema,
  type InstallManifestEntry,
} from './install-manifest-schema.js';
import {
  installManifestPath,
  loadInstallManifestRows,
  serializeInstallManifest,
  type InstallManifestRows,
} from './install-manifest-rows.js';
import { normalizePersistedInstallPaths } from './portable-paths.js';
import { sameFeatureSet } from './pick-reuse-entry-name.js';

export {
  installManifestEntrySchema,
  installManifestSchema,
  type InstallManifestEntry,
} from './install-manifest-schema.js';

function sameInstallIdentity(a: InstallManifestEntry, b: InstallManifestEntry): boolean {
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.as === b.as &&
    sameFeatureSet(a.features, b.features)
  );
}

export async function readInstallManifest(canonicalDir: string): Promise<InstallManifestEntry[]> {
  const rows = await loadInstallManifestRows(canonicalDir);
  if (rows.parseError !== undefined) {
    logger.warn(
      `${installManifestPath(canonicalDir).replaceAll('\\', '/')} could not be parsed (${rows.parseError}); treating the manifest as empty`,
    );
  }
  return rows.installs;
}

/** Load rows for a rewrite; an unreadable file is never overwritten. */
async function loadRowsForRewrite(canonicalDir: string): Promise<InstallManifestRows> {
  const rows = await loadInstallManifestRows(canonicalDir);
  if (rows.parseError !== undefined) {
    throw new Error(
      `${installManifestPath(canonicalDir).replaceAll('\\', '/')} could not be parsed (${rows.parseError}); refusing to rewrite it. Fix the YAML by hand and retry.`,
    );
  }
  return rows;
}

export async function upsertInstallManifestEntry(
  canonicalDir: string,
  entry: InstallManifestEntry,
): Promise<void> {
  const normalizedEntry = normalizePersistedInstallPaths(entry);
  const rows = await loadRowsForRewrite(canonicalDir);
  const next = rows.installs.filter(
    (install) =>
      install.name !== normalizedEntry.name && !sameInstallIdentity(install, normalizedEntry),
  );
  next.push(normalizedEntry);
  await writeFileAtomic(
    installManifestPath(canonicalDir),
    serializeInstallManifest(next, rows.rejected),
  );
}

/**
 * Remove a single install entry by name. Returns `true` when an entry was
 * found and the file was rewritten, `false` when no entry matched and the
 * file is unchanged. The rewrite is atomic via `writeFileAtomic`.
 */
export async function removeInstallManifestEntry(
  canonicalDir: string,
  name: string,
): Promise<boolean> {
  const rows = await loadRowsForRewrite(canonicalDir);
  const next = rows.installs.filter((entry) => entry.name !== name);
  if (next.length === rows.installs.length) return false;
  await writeFileAtomic(
    installManifestPath(canonicalDir),
    serializeInstallManifest(next, rows.rejected),
  );
  return true;
}

export function buildInstallManifestEntry(args: {
  name: string;
  source: string;
  version?: string;
  sourceKind: InstallManifestEntry['source_kind'];
  features: InstallManifestEntry['features'];
  pick?: InstallManifestEntry['pick'];
  target?: InstallManifestEntry['target'];
  path?: string;
  paths?: string[];
  as?: ManualInstallAs;
  refreshed_at?: string;
  originalRef?: string;
  acceptedElevated?: InstallManifestEntry['accepted_elevated'];
}): InstallManifestEntry {
  return normalizePersistedInstallPaths(
    installManifestEntrySchema.parse({
      name: args.name,
      source: args.source,
      version: args.version,
      source_kind: args.sourceKind,
      features: args.features,
      pick: args.pick,
      target: args.target,
      path: args.path,
      paths: args.paths,
      as: args.as,
      refreshed_at: args.refreshed_at,
      original_ref: args.originalRef,
      accepted_elevated: args.acceptedElevated,
    }),
  );
}
