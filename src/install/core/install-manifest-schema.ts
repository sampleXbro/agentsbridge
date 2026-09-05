/**
 * Zod schemas for `installs.yaml` rows and the manifest envelope.
 */

import { z } from 'zod';
import { extendPickSchema, featureSchema, targetSchema } from '../../config/core/schema.js';
import { manualInstallAsSchema } from '../manual/manual-install-mode.js';

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
  original_ref: z.string().optional(),
  /**
   * Elevated artifacts (hooks/permissions/mcp) the user explicitly consented
   * to at install time via `--accept-*`. Persisted so the sync/refresh bridges
   * can re-apply that consent automatically when they replay the install —
   * otherwise a deterministic re-clone would silently strip the artifacts and
   * desync the pack contents from the recorded `features`.
   */
  accepted_elevated: z
    .array(z.enum(['hooks', 'permissions', 'mcp']))
    .min(1)
    .optional(),
});

export const installManifestSchema = z.object({
  version: z.literal(1),
  // Post-processed by `stripRequiredFromDefaults()` in the schema generator
  // so the emitted JSON Schema marks `installs` as not-required (a
  // freshly-created or fully-uninstalled manifest is just `version: 1`).
  // Runtime parser still substitutes `[]` for an absent field.
  installs: z.array(installManifestEntrySchema).default([]),
});

/** Envelope only: rows are validated one by one so a bad row cannot wipe the file. */
export const installManifestEnvelopeSchema = z.object({
  version: z.literal(1),
  installs: z.array(z.unknown()).default([]),
});

export type InstallManifestEntry = z.infer<typeof installManifestEntrySchema>;
