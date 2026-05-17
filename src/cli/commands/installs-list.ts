/**
 * `agentsmesh installs list` — read-only inventory of installed packs.
 *
 * Reads `installs.yaml` (project or `--global` scope) and, when a pack
 * directory carries `.agentsmesh-install-manifest.json`, hydrates each row
 * with `installed_at` + `source_type` from that file. Rows are returned in
 * yaml insertion order (no resort) so callers see whatever order
 * `upsertInstallManifestEntry` last wrote.
 *
 * No writes, no prompts, no network. Forward-slash `pack_path` per the
 * project CLI display rule.
 */

import { join, relative } from 'node:path';
import { resolveScopeContext } from '../../config/core/scope.js';
import { readInstallManifest } from '../../install/core/install-manifest.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { INSTALL_MANIFEST_FILENAME } from '../../install/manifest/install-manifest-hash.js';
import type { InstallsListData, InstallsListEntry } from '../command-result.js';

export interface InstallsListResult {
  exitCode: number;
  data: InstallsListData;
}

interface PackManifestMeta {
  readonly installed_at: string | null;
  readonly source_type: string | null;
}

async function readPackManifestMeta(packDir: string): Promise<PackManifestMeta> {
  const content = await readFileSafe(join(packDir, INSTALL_MANIFEST_FILENAME));
  if (content === null) return { installed_at: null, source_type: null };
  try {
    const raw = JSON.parse(content) as {
      installed_at?: unknown;
      source_type?: unknown;
    };
    return {
      installed_at: typeof raw.installed_at === 'string' ? raw.installed_at : null,
      source_type: typeof raw.source_type === 'string' ? raw.source_type : null,
    };
  } catch {
    return { installed_at: null, source_type: null };
  }
}

function toForwardSlashRel(rootBase: string, abs: string): string {
  return relative(rootBase, abs).replaceAll('\\', '/');
}

export async function runInstallsList(
  flags: Record<string, string | boolean>,
  projectRoot: string,
): Promise<InstallsListResult> {
  const scope: 'project' | 'global' = flags.global === true ? 'global' : 'project';
  const context = resolveScopeContext(projectRoot, scope);

  const entries = await readInstallManifest(context.canonicalDir);
  const packsDir = join(context.canonicalDir, 'packs');

  const rows: InstallsListEntry[] = [];
  for (const entry of entries) {
    const packDir = join(packsDir, entry.name);
    const meta = await readPackManifestMeta(packDir);
    rows.push({
      name: entry.name,
      source: entry.source,
      source_kind: entry.source_kind,
      source_type: meta.source_type,
      version: entry.version ?? null,
      features: [...entry.features],
      target: entry.target ?? null,
      installed_at: meta.installed_at,
      pack_path: toForwardSlashRel(context.rootBase, packDir),
    });
  }

  return {
    exitCode: 0,
    data: { scope, subcommand: 'list', installs: rows },
  };
}
