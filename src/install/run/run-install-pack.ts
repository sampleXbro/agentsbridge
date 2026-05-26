/**
 * Materialize an install as a local pack (default install behavior).
 */

import { join } from 'node:path';
import { rename } from 'node:fs/promises';
import type { CanonicalFiles } from '../../core/types.js';
import type { ExtendPick } from '../../config/core/schema.js';
import type { PackMetadata } from '../pack/pack-schema.js';
import { materializePack } from '../pack/pack-writer.js';
import { findExistingPack, readPackMetadata } from '../pack/pack-reader.js';
import { mergeIntoPack } from '../pack/pack-merge.js';
import { cleanInstallCache } from '../pack/cache-cleanup.js';
import { collectPreservedRootFiles } from '../source/collect-preserved-root.js';
import { ruleSlug } from '../core/validate-resources.js';
import { targetSchema } from '../../config/core/schema.js';
import { logger } from '../../utils/output/logger.js';
import { buildInstallManifestEntry, upsertInstallManifestEntry } from '../core/install-manifest.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';
import { exists } from '../../utils/filesystem/fs.js';

export interface InstallAsPackArgs {
  canonicalDir: string;
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
  /** Classifier verdict that drove this install; written to `.agentsmesh-install-manifest.json`. */
  sourceType?: string;
  /**
   * Upstream source root from which `narrowed` was discovered. Used to
   * harvest top-level preserved-boilerplate files (README/LICENSE/…) into the
   * pack root. Optional — when omitted, no preserved files are copied.
   */
  contentRoot?: string;
  /**
   * When true, skip the `findExistingPack` merge path and force a full
   * materialize of the new content. Used by `agentsmesh refresh` to replace
   * a pack's contents with a fresh ref rather than merging into the existing
   * pack. When omitted or false, existing merge behavior is preserved.
   */
  forceFreshMaterialize?: boolean;
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
    canonicalDir,
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
    sourceType,
    contentRoot,
    forceFreshMaterialize,
  } = args;

  const packsDir = join(canonicalDir, 'packs');
  const selectedCanonical = applySelection(narrowed, selected);
  const preservedRootFiles = contentRoot ? await collectPreservedRootFiles(contentRoot) : [];
  const now = new Date().toISOString();
  const parsedTarget = yamlTarget !== undefined ? targetSchema.parse(yamlTarget) : undefined;

  const existingPack = forceFreshMaterialize
    ? null
    : await findExistingPack(packsDir, sourceForYaml, {
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
      preservedRootFiles,
    );
    persistedName = mergedMeta.name;
    persistedFeatures = mergedMeta.features;
    persistedPick = mergedMeta.pick;
    persistedPath = mergedMeta.path;
    persistedPaths = mergedMeta.paths;
    logger.success(`Updated pack "${mergedMeta.name}" in .agentsmesh/packs/.`);
  } else {
    if (!forceFreshMaterialize) {
      const collidingMeta = await readPackMetadata(join(packsDir, packName));
      if (collidingMeta) {
        throw new Error(
          `Auto-generated pack name "${packName}" collides with an existing incompatible pack. Use --name to choose a different pack name.`,
        );
      }
    }
    await materializePack(
      packsDir,
      packName,
      selectedCanonical,
      {
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
      },
      sourceType !== undefined ? { source_type: sourceType } : {},
      preservedRootFiles,
    );
    logger.success(`Installed pack "${packName}" to .agentsmesh/packs/.`);
  }

  await upsertInstallManifestEntry(
    canonicalDir,
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
