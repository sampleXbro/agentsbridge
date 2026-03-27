/**
 * Pack metadata schema for .agentsmesh/packs/{name}/pack.yaml
 */

import { z } from 'zod';
import { featureSchema, extendPickSchema, targetSchema } from '../../config/core/schema.js';
import { manualInstallAsSchema } from '../manual/manual-install-mode.js';

const sourceKindSchema = z.enum(['github', 'gitlab', 'git', 'local']);

export const packMetadataSchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  version: z.string().optional(),
  source_kind: sourceKindSchema,
  installed_at: z.string(),
  updated_at: z.string(),
  features: z.array(featureSchema).min(1),
  pick: extendPickSchema.optional(),
  target: targetSchema.optional(),
  path: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1).optional(),
  as: manualInstallAsSchema.optional(),
  content_hash: z.string(),
});

export type PackMetadata = z.infer<typeof packMetadataSchema>;
