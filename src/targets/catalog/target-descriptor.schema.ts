/**
 * Runtime Zod schema for TargetDescriptor.
 * Validates plugin-provided descriptors before registration.
 * Strategy: validate structural fields tightly; treat callbacks as z.function()
 * (Zod's function validation is weak — TypeScript catches real errors at plugin build time).
 */

import { z } from 'zod';
import type { TargetDescriptor } from './target-descriptor.js';

const capabilityLevelSchema = z.union([
  z.enum(['native', 'embedded', 'partial', 'none']),
  z.object({
    level: z.enum(['native', 'embedded', 'partial', 'none']),
    flavor: z.string().optional(),
  }),
]);

const capabilitiesSchema = z.object({
  rules: capabilityLevelSchema,
  additionalRules: capabilityLevelSchema,
  commands: capabilityLevelSchema,
  agents: capabilityLevelSchema,
  skills: capabilityLevelSchema,
  mcp: capabilityLevelSchema,
  hooks: capabilityLevelSchema,
  ignore: capabilityLevelSchema,
  permissions: capabilityLevelSchema,
});

const generatorsSchema = z
  .object({
    name: z.string(),
    generateRules: z.function(),
    importFrom: z.function(),
    generateCommands: z.function().optional(),
    generateAgents: z.function().optional(),
    generateSkills: z.function().optional(),
    generateMcp: z.function().optional(),
    generatePermissions: z.function().optional(),
    generateHooks: z.function().optional(),
    generateIgnore: z.function().optional(),
    lint: z.function().optional(),
  })
  .passthrough();

const pathResolversSchema = z.object({
  rulePath: z.function(),
  commandPath: z.function(),
  agentPath: z.function(),
});

const layoutSchema = z
  .object({
    paths: pathResolversSchema,
  })
  .passthrough();

/**
 * Structural Zod schema for TargetDescriptor.
 * Uses passthrough() on the root so unknown plugin fields don't cause rejection.
 */
export const targetDescriptorSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Target id must be lowercase with hyphens'),
    generators: generatorsSchema,
    capabilities: capabilitiesSchema,
    emptyImportMessage: z.string(),
    lintRules: z.union([z.function(), z.null()]),
    project: layoutSchema,
    buildImportPaths: z.function(),
    detectionPaths: z.array(z.string()),
  })
  .passthrough() as unknown as z.ZodSchema<TargetDescriptor>;

/**
 * Validate a plugin-provided descriptor.
 * @throws ZodError if the shape is invalid
 */
export function validateDescriptor(value: unknown): TargetDescriptor {
  return targetDescriptorSchema.parse(value);
}
