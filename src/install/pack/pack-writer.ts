/**
 * Materialize canonical files into a pack directory.
 */

import { join, basename, dirname } from 'node:path';
import { rm, rename, mkdir, copyFile } from 'node:fs/promises';
import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../core/types.js';
import type { PackMetadata } from './pack-schema.js';
import { writeFileAtomic, exists, mkdirp } from '../../utils/filesystem/fs.js';
import { hashPackContent } from './pack-hash.js';
import { normalizePersistedInstallPaths } from '../core/portable-paths.js';

type PackMetadataInput = Omit<PackMetadata, 'content_hash'>;

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

/**
 * Materialize canonical resources into a pack directory under packsDir.
 * Uses atomic .tmp → rename pattern.
 *
 * @param packsDir - Absolute path to .agentsmesh/packs/
 * @param packName - Directory name for this pack
 * @param canonical - Canonical files to write (already filtered + picked)
 * @param metadataInput - Pack metadata without content_hash (computed after write)
 * @returns Full PackMetadata including content_hash
 */
export async function materializePack(
  packsDir: string,
  packName: string,
  canonical: CanonicalFiles,
  metadataInput: PackMetadataInput,
): Promise<PackMetadata> {
  const tmpDir = join(packsDir, `${packName}.tmp`);
  const finalDir = join(packsDir, packName);

  // Clean up stale .tmp if exists
  if (await exists(tmpDir)) {
    await rm(tmpDir, { recursive: true, force: true });
  }

  await mkdirp(tmpDir);

  // Write canonical resources
  await writeRules(canonical, tmpDir);
  await writeCommands(canonical, tmpDir);
  await writeAgents(canonical, tmpDir);
  await writeSkills(canonical, tmpDir);
  await writeSettings(canonical, tmpDir);

  // Compute content hash (excludes pack.yaml)
  const contentHash = await hashPackContent(tmpDir);

  // Write pack.yaml
  const metadata: PackMetadata = normalizePersistedInstallPaths({
    ...metadataInput,
    content_hash: contentHash,
  });
  await writeFileAtomic(join(tmpDir, 'pack.yaml'), yamlStringify(metadata));

  // Atomic rename to final
  if (await exists(finalDir)) {
    await rm(finalDir, { recursive: true, force: true });
  }
  await mkdir(packsDir, { recursive: true });
  await rename(tmpDir, finalDir);

  return metadata;
}
