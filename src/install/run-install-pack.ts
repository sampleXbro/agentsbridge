/**
 * Materialize an install as a local pack (default install behavior).
 */

import { join } from 'node:path';
import { rename } from 'node:fs/promises';
import type { CanonicalFiles } from '../core/types.js';
import type { ExtendPick } from '../config/schema.js';
import type { PackMetadata } from './pack-schema.js';
import { materializePack } from './pack-writer.js';
import { findExistingPack, readPackMetadata } from './pack-reader.js';
import { mergeIntoPack } from './pack-merge.js';
import { cleanInstallCache } from './cache-cleanup.js';
import { ruleSlug } from './validate-resources.js';
import { targetSchema } from '../config/schema.js';
import { logger } from '../utils/logger.js';
import { buildInstallManifestEntry, upsertInstallManifestEntry } from './install-manifest.js';
import type { ManualInstallAs } from './manual-install-mode.js';
import { exists } from '../utils/fs.js';

export interface InstallAsPackArgs {
  configDir: string;
  packName: string;
  narrowed: CanonicalFiles;
  selected: {
    skillNames: string[];
    ruleSlugs: string[];
    commandNames: string[];
    agentNames: string[];
  };
  sourceForYaml: string;
  version?: string;
  sourceKind: PackMetadata['source_kind'];
  entryFeatures: PackMetadata['features'];
  pick: ExtendPick | undefined;
  yamlTarget?: string;
  pathInRepo?: string;
  manualAs?: ManualInstallAs;
  renameExistingPack?: boolean;
}

function pathScope(pathInRepo?: string): Pick<PackMetadata, 'path' | 'paths'> {
  if (!pathInRepo) {
    return { path: undefined, paths: undefined };
  }
  return { path: pathInRepo, paths: undefined };
}

function applySelection(
  canonical: CanonicalFiles,
  selected: InstallAsPackArgs['selected'],
): CanonicalFiles {
  const skillSet = new Set(selected.skillNames);
  const ruleSlugSet = new Set(selected.ruleSlugs);
  const cmdSet = new Set(selected.commandNames);
  const agentSet = new Set(selected.agentNames);
  return {
    ...canonical,
    skills: canonical.skills.filter((s) => skillSet.has(s.name)),
    rules: canonical.rules.filter((r) => ruleSlugSet.has(ruleSlug(r))),
    commands: canonical.commands.filter((c) => cmdSet.has(c.name)),
    agents: canonical.agents.filter((a) => agentSet.has(a.name)),
  };
}

/**
 * Install discovered resources as a local pack (default mode).
 * Detects existing pack by source to merge incrementally.
 * Cleans cache entry on success for remote sources.
 */
export async function installAsPack(args: InstallAsPackArgs): Promise<void> {
  const {
    configDir,
    packName,
    narrowed,
    selected,
    sourceForYaml,
    version,
    sourceKind,
    entryFeatures,
    pick,
    yamlTarget,
    pathInRepo,
    manualAs,
    renameExistingPack,
  } = args;

  const packsDir = join(configDir, '.agentsmesh', 'packs');
  const selectedCanonical = applySelection(narrowed, selected);
  const now = new Date().toISOString();
  const parsedTarget = yamlTarget !== undefined ? targetSchema.parse(yamlTarget) : undefined;

  const existingPack = await findExistingPack(packsDir, sourceForYaml, {
    target: parsedTarget,
    as: manualAs,
    features: entryFeatures,
  });
  let persistedName = packName;
  let persistedFeatures = entryFeatures;
  let persistedPick = pick;
  let persistedPath = pathInRepo;
  let persistedPaths: string[] | undefined;
  if (existingPack) {
    let packDir = existingPack.packDir;
    let packMeta = existingPack.meta;
    if (renameExistingPack && existingPack.name !== packName) {
      const nextDir = join(packsDir, packName);
      if (await exists(nextDir)) {
        throw new Error(
          `Auto-generated pack name "${packName}" collides with an existing incompatible pack. Use --name to choose a different pack name.`,
        );
      }
      await rename(existingPack.packDir, nextDir);
      packDir = nextDir;
      packMeta = { ...existingPack.meta, name: packName };
    }
    const mergedMeta = await mergeIntoPack(
      packDir,
      packMeta,
      selectedCanonical,
      entryFeatures as string[],
      pick,
      {
        source: sourceForYaml,
        ...(version !== undefined ? { version } : {}),
        ...(parsedTarget !== undefined ? { target: parsedTarget } : {}),
        ...(pathInRepo ? { path: pathInRepo } : {}),
        ...(manualAs !== undefined ? { as: manualAs } : {}),
      },
    );
    persistedName = mergedMeta.name;
    persistedFeatures = mergedMeta.features;
    persistedPick = mergedMeta.pick;
    persistedPath = mergedMeta.path;
    persistedPaths = mergedMeta.paths;
    logger.success(`Updated pack "${mergedMeta.name}" in .agentsmesh/packs/.`);
  } else {
    const collidingMeta = await readPackMetadata(join(packsDir, packName));
    if (collidingMeta) {
      throw new Error(
        `Auto-generated pack name "${packName}" collides with an existing incompatible pack. Use --name to choose a different pack name.`,
      );
    }
    await materializePack(packsDir, packName, selectedCanonical, {
      name: packName,
      source: sourceForYaml,
      ...(version !== undefined && { version }),
      source_kind: sourceKind,
      installed_at: now,
      updated_at: now,
      features: entryFeatures,
      ...(pick !== undefined && { pick }),
      ...(parsedTarget !== undefined && { target: parsedTarget }),
      ...pathScope(pathInRepo),
      ...(manualAs !== undefined && { as: manualAs }),
    });
    logger.success(`Installed pack "${packName}" to .agentsmesh/packs/.`);
  }

  await upsertInstallManifestEntry(
    configDir,
    buildInstallManifestEntry({
      name: persistedName,
      source: sourceForYaml,
      version,
      sourceKind,
      features: persistedFeatures,
      pick: persistedPick,
      target: parsedTarget,
      path: persistedPath,
      paths: persistedPaths,
      as: manualAs,
    }),
  );

  if (sourceKind !== 'local') {
    await cleanInstallCache(sourceForYaml);
  }
}
