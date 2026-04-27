/**
 * Persist install provenance so packs can be re-synced after local deletion.
 */

import { join } from 'node:path';
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import { z } from 'zod';
import { extendPickSchema, featureSchema, targetSchema } from '../../config/core/schema.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { manualInstallAsSchema, type ManualInstallAs } from '../manual/manual-install-mode.js';
import { normalizePersistedInstallPaths } from './portable-paths.js';

const installManifestEntrySchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  version: z.string().optional(),
  source_kind: z.enum(['github', 'gitlab', 'git', 'local']),
  features: z.array(featureSchema).min(1),
  pick: extendPickSchema.optional(),
  target: targetSchema.optional(),
  path: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1).optional(),
  as: manualInstallAsSchema.optional(),
});

const installManifestSchema = z.object({
  version: z.literal(1),
  installs: z.array(installManifestEntrySchema).default([]),
});

export type InstallManifestEntry = z.infer<typeof installManifestEntrySchema>;

function sameFeatures(a: string[], b: string[]): boolean {
  return (
    a.length === b.length &&
    [...a].sort().every((feature, index) => feature === [...b].sort()[index])
  );
}

function sameInstallIdentity(a: InstallManifestEntry, b: InstallManifestEntry): boolean {
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.as === b.as &&
    sameFeatures(a.features, b.features)
  );
}

function manifestPath(canonicalDir: string): string {
  return join(canonicalDir, 'installs.yaml');
}

export async function readInstallManifest(canonicalDir: string): Promise<InstallManifestEntry[]> {
  const content = await readFileSafe(manifestPath(canonicalDir));
  if (content === null) return [];
  try {
    return installManifestSchema
      .parse(parseYaml(content) as unknown)
      .installs.map((entry) => normalizePersistedInstallPaths(entry));
  } catch {
    return [];
  }
}

export async function upsertInstallManifestEntry(
  canonicalDir: string,
  entry: InstallManifestEntry,
): Promise<void> {
  const normalizedEntry = normalizePersistedInstallPaths(entry);
  const installs = await readInstallManifest(canonicalDir);
  const next = installs.filter(
    (install) =>
      install.name !== normalizedEntry.name && !sameInstallIdentity(install, normalizedEntry),
  );
  next.push(normalizedEntry);
  await writeFileAtomic(
    manifestPath(canonicalDir),
    yamlStringify({ version: 1, installs: next.sort((a, b) => a.name.localeCompare(b.name)) }),
  );
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
    }),
  );
}
