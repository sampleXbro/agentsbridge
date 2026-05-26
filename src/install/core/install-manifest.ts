/**
 * Persist install provenance so packs can be re-synced after local deletion.
 */

import { join } from 'node:path';
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import { z } from 'zod';
import { extendPickSchema, featureSchema, targetSchema } from '../../config/core/schema.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { prependYamlSchemaDirective } from '../../utils/output/schema-directive.js';
import { manualInstallAsSchema, type ManualInstallAs } from '../manual/manual-install-mode.js';
import { normalizePersistedInstallPaths } from './portable-paths.js';
import { sameFeatureSet } from './pick-reuse-entry-name.js';

/**
 * `name` becomes `join(packsDir, name)` at uninstall time. A poisoned manifest
 * entry like `name: "../../tmp/victim"` would otherwise cause `rm -rf` outside
 * `.agentsmesh/packs/`. Mirrors `validatePackName` in `pack-writer.ts`.
 */
const isSafeInstallName = (name: string): boolean =>
  !name.includes('/') &&
  !name.includes('\\') &&
  !name.includes('\0') &&
  name !== '.' &&
  name !== '..';

export const installManifestEntrySchema = z.object({
  name: z.string().min(1).refine(isSafeInstallName, {
    message: 'install name must not contain path separators, NUL, or "."/".." segments',
  }),
  source: z.string().min(1),
  version: z.string().optional(),
  source_kind: z.enum(['github', 'gitlab', 'git', 'local']),
  features: z.array(featureSchema).min(1),
  pick: extendPickSchema.optional(),
  target: targetSchema.optional(),
  path: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1).optional(),
  as: manualInstallAsSchema.optional(),
  refreshed_at: z.string().min(1).optional(),
});

export const installManifestSchema = z.object({
  version: z.literal(1),
  // Post-processed by `stripRequiredFromDefaults()` in the schema generator
  // so the emitted JSON Schema marks `installs` as not-required (a
  // freshly-created or fully-uninstalled manifest is just `version: 1`).
  // Runtime parser still substitutes `[]` for an absent field.
  installs: z.array(installManifestEntrySchema).default([]),
});

export type InstallManifestEntry = z.infer<typeof installManifestEntrySchema>;

function sameInstallIdentity(a: InstallManifestEntry, b: InstallManifestEntry): boolean {
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.as === b.as &&
    sameFeatureSet(a.features, b.features)
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
    prependYamlSchemaDirective(
      yamlStringify({ version: 1, installs: next.sort((a, b) => a.name.localeCompare(b.name)) }),
      'installs',
    ),
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
  const installs = await readInstallManifest(canonicalDir);
  const next = installs.filter((entry) => entry.name !== name);
  if (next.length === installs.length) return false;
  await writeFileAtomic(
    manifestPath(canonicalDir),
    prependYamlSchemaDirective(
      yamlStringify({ version: 1, installs: next.sort((a, b) => a.name.localeCompare(b.name)) }),
      'installs',
    ),
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
    }),
  );
}
