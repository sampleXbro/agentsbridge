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

const globalSupportSchema = z
  .object({
    capabilities: capabilitiesSchema,
    detectionPaths: z.array(z.string()),
    layout: layoutSchema,
    scopeExtras: z.function().optional(),
  })
  .passthrough();

const legacyGlobalKeys = [
  'global',
  'globalCapabilities',
  'globalDetectionPaths',
  'generateScopeExtras',
] as const;

type CapabilitiesShape = z.infer<typeof capabilitiesSchema>;
type GeneratorsShape = z.infer<typeof generatorsSchema>;

interface DescriptorShape {
  readonly generators: GeneratorsShape;
  readonly emitScopedSettings?: unknown;
}

const generatorRequirements = [
  { feature: 'commands', generator: 'generateCommands' },
  { feature: 'agents', generator: 'generateAgents' },
  { feature: 'skills', generator: 'generateSkills' },
  { feature: 'mcp', generator: 'generateMcp' },
  { feature: 'hooks', generator: 'generateHooks' },
  { feature: 'ignore', generator: 'generateIgnore' },
  { feature: 'permissions', generator: 'generatePermissions' },
] as const;

const settingsBackedFeatures = ['mcp', 'hooks', 'ignore', 'permissions'] as const;

function capabilityLevel(capability: CapabilitiesShape[keyof CapabilitiesShape]): string {
  return typeof capability === 'string' ? capability : capability.level;
}

function canUseScopedSettings(feature: (typeof generatorRequirements)[number]['feature']): boolean {
  return (settingsBackedFeatures as readonly string[]).includes(feature);
}

function validateCapabilityImplementations(
  descriptor: DescriptorShape,
  capabilities: CapabilitiesShape,
  ctx: z.RefinementCtx,
  pathPrefix: readonly (string | number)[],
): void {
  for (const requirement of generatorRequirements) {
    const level = capabilityLevel(capabilities[requirement.feature]);
    if (level === 'none') continue;
    const hasGenerator = typeof descriptor.generators[requirement.generator] === 'function';
    const hasSettingsEmitter =
      canUseScopedSettings(requirement.feature) &&
      typeof descriptor.emitScopedSettings === 'function';
    if (hasGenerator || hasSettingsEmitter) continue;
    ctx.addIssue({
      code: 'custom',
      path: [...pathPrefix, requirement.feature],
      message:
        `Capability "${requirement.feature}" is "${level}" but ` +
        `generators.${requirement.generator}` +
        (canUseScopedSettings(requirement.feature) ? ' or emitScopedSettings' : '') +
        ' is missing.',
    });
  }
}

/**
 * Structural Zod schema for TargetDescriptor.
 * Uses passthrough() on the root so unknown plugin fields don't cause rejection.
 */
const targetDescriptorSchemaBase = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Target id must be lowercase with hyphens'),
    generators: generatorsSchema,
    capabilities: capabilitiesSchema,
    emptyImportMessage: z.string(),
    lintRules: z.union([z.function(), z.null()]),
    project: layoutSchema,
    globalSupport: globalSupportSchema.optional(),
    buildImportPaths: z.function(),
    detectionPaths: z.array(z.string()),
  })
  .passthrough();

export const targetDescriptorSchema = targetDescriptorSchemaBase.superRefine((value, ctx) => {
  for (const key of legacyGlobalKeys) {
    if (key in value) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `Use globalSupport instead of legacy field "${key}".`,
      });
    }
  }
  validateCapabilityImplementations(value, value.capabilities, ctx, ['capabilities']);
  if (value.globalSupport !== undefined) {
    validateCapabilityImplementations(value, value.globalSupport.capabilities, ctx, [
      'globalSupport',
      'capabilities',
    ]);
  }
}) as unknown as z.ZodSchema<TargetDescriptor>;

/**
 * Validate a plugin-provided descriptor.
 * @throws ZodError if the shape is invalid
 */
export function validateDescriptor(value: unknown): TargetDescriptor {
  return targetDescriptorSchema.parse(value);
}
