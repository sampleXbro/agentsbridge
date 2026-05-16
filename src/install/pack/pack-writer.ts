/**
 * Materialize canonical files into a pack directory.
 *
 * Atomicity model: every write happens inside `${packName}.tmp/` (the
 * "staging" dir). Only after content + `pack.yaml` +
 * `.agentsmesh-install-manifest.json` are durable do we rename the staging
 * dir to the final `${packName}/`. Any error before the rename rolls back
 * the staging dir, so a half-written pack never appears at the destination.
 */

import { join, basename, dirname } from 'node:path';
import { rm, rename, mkdir, copyFile } from 'node:fs/promises';
import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../core/types.js';
import type { PackMetadata } from './pack-schema.js';
import { writeFileAtomic, exists, mkdirp } from '../../utils/filesystem/fs.js';
import { hashPackContent } from './pack-hash.js';
import { hashPackFiles, INSTALL_MANIFEST_FILENAME } from '../manifest/install-manifest-hash.js';
import { normalizePersistedInstallPaths } from '../core/portable-paths.js';

type PackMetadataInput = Omit<PackMetadata, 'content_hash'>;

export interface InstallManifestExtras {
  /** `null` for materialized installs; the extend entry id when extending. */
  readonly extends_id?: string | null;
  /** Classifier verdict that drove this install (e.g. `anthropic-skill-pack`). */
  readonly source_type?: string | null;
}

/** Write rules to packDir/rules/ by copying source files. */
async function writeRules(canonical: CanonicalFiles, packDir: string): Promise<void> {
  if (canonical.rules.length === 0) return;
  const rulesDir = join(packDir, 'rules');
  await mkdirp(rulesDir);
  for (const rule of canonical.rules) {
    const dest = join(rulesDir, basename(rule.source));
    await copyFile(rule.source, dest);
  }
}

/** Write commands to packDir/commands/ by copying source files. */
async function writeCommands(canonical: CanonicalFiles, packDir: string): Promise<void> {
  if (canonical.commands.length === 0) return;
  const dir = join(packDir, 'commands');
  await mkdirp(dir);
  for (const cmd of canonical.commands) {
    const dest = join(dir, basename(cmd.source));
    await copyFile(cmd.source, dest);
  }
}

/** Write agents to packDir/agents/ by copying source files. */
async function writeAgents(canonical: CanonicalFiles, packDir: string): Promise<void> {
  if (canonical.agents.length === 0) return;
  const dir = join(packDir, 'agents');
  await mkdirp(dir);
  for (const agent of canonical.agents) {
    const dest = join(dir, basename(agent.source));
    await copyFile(agent.source, dest);
  }
}

/** Write skills to packDir/skills/{name}/ with SKILL.md and supporting files. */
async function writeSkills(canonical: CanonicalFiles, packDir: string): Promise<void> {
  if (canonical.skills.length === 0) return;
  const skillsDir = join(packDir, 'skills');
  await mkdirp(skillsDir);
  for (const skill of canonical.skills) {
    const skillDestDir = join(skillsDir, skill.name);
    await mkdirp(skillDestDir);
    // Copy SKILL.md
    await copyFile(skill.source, join(skillDestDir, 'SKILL.md'));
    // Copy supporting files
    for (const sf of skill.supportingFiles) {
      const destPath = join(skillDestDir, sf.relativePath);
      await mkdirp(dirname(destPath));
      await copyFile(sf.absolutePath, destPath);
    }
  }
}

async function writeSettings(canonical: CanonicalFiles, packDir: string): Promise<void> {
  if (canonical.mcp !== null) {
    await writeFileAtomic(join(packDir, 'mcp.json'), `${JSON.stringify(canonical.mcp, null, 2)}\n`);
  }
  if (canonical.permissions !== null) {
    await writeFileAtomic(join(packDir, 'permissions.yaml'), yamlStringify(canonical.permissions));
  }
  if (canonical.hooks !== null) {
    await writeFileAtomic(join(packDir, 'hooks.yaml'), yamlStringify(canonical.hooks));
  }
  if (canonical.ignore.length > 0) {
    await writeFileAtomic(join(packDir, 'ignore'), `${canonical.ignore.join('\n')}\n`);
  }
}

function validatePackName(name: string): void {
  if (
    name.includes('/') ||
    name.includes('\\') ||
    name === '..' ||
    name === '.' ||
    name.includes('\0')
  ) {
    throw new Error(
      `Invalid pack name "${name}". Pack names must be a single directory segment without path separators.`,
    );
  }
}

async function writeInstallManifest(
  stagingDir: string,
  metadata: PackMetadata,
  extras: InstallManifestExtras,
): Promise<void> {
  const files = await hashPackFiles(stagingDir);
  const manifest = {
    name: metadata.name,
    source: metadata.source,
    installed_at: metadata.installed_at,
    extends_id: extras.extends_id ?? null,
    source_type: extras.source_type ?? null,
    files,
  };
  await writeFileAtomic(
    join(stagingDir, INSTALL_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

/**
 * Materialize canonical resources into a pack directory under packsDir.
 *
 * @param packsDir - Absolute path to `.agentsmesh/packs/`
 * @param packName - Directory name for this pack
 * @param canonical - Canonical files to write (already filtered + picked)
 * @param metadataInput - Pack metadata without `content_hash` (computed after write)
 * @param installManifestExtras - Optional extras for `.agentsmesh-install-manifest.json`
 * @returns Full PackMetadata including `content_hash`
 */
export async function materializePack(
  packsDir: string,
  packName: string,
  canonical: CanonicalFiles,
  metadataInput: PackMetadataInput,
  installManifestExtras: InstallManifestExtras = {},
): Promise<PackMetadata> {
  validatePackName(packName);
  const tmpDir = join(packsDir, `${packName}.tmp`);
  const finalDir = join(packsDir, packName);

  // Clean up stale .tmp if exists (from a prior aborted install).
  if (await exists(tmpDir)) {
    await rm(tmpDir, { recursive: true, force: true });
  }

  let metadata: PackMetadata;
  try {
    await mkdirp(tmpDir);

    // Write canonical resources
    await writeRules(canonical, tmpDir);
    await writeCommands(canonical, tmpDir);
    await writeAgents(canonical, tmpDir);
    await writeSkills(canonical, tmpDir);
    await writeSettings(canonical, tmpDir);

    // Compute aggregate content hash (excludes pack.yaml + install manifest).
    const contentHash = await hashPackContent(tmpDir);

    // Write pack.yaml
    metadata = normalizePersistedInstallPaths({
      ...metadataInput,
      content_hash: contentHash,
    });
    await writeFileAtomic(join(tmpDir, 'pack.yaml'), yamlStringify(metadata));

    // Write .agentsmesh-install-manifest.json (per-file sha256 map).
    await writeInstallManifest(tmpDir, metadata, installManifestExtras);

    // Atomic rename to final
    if (await exists(finalDir)) {
      await rm(finalDir, { recursive: true, force: true });
    }
    await mkdir(packsDir, { recursive: true });
    await rename(tmpDir, finalDir);
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  return metadata;
}
