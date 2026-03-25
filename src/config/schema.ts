import { z } from 'zod';
import { TARGET_IDS } from '../targets/target-catalog.js';

const VALID_FEATURES = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
] as const;

/** Valid `extends[].target` / `agentsbridge install --target` identifiers */
export const targetSchema = z.enum(TARGET_IDS);
export const featureSchema = z.enum(VALID_FEATURES);

/** Cherry-pick resource names within array features (extends.install + merge). */
export const extendPickSchema = z
  .object({
    skills: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    rules: z.array(z.string()).optional(),
    agents: z.array(z.string()).optional(),
  })
  .strict();

export type ExtendPick = z.infer<typeof extendPickSchema>;

const extendSourceSchema = z.object({
  name: z.string(),
  source: z.string(),
  version: z.string().optional(),
  target: targetSchema.optional(),
  features: z.array(featureSchema),
  /** Repo-relative POSIX path for discovery (skill packs, nested .agentsbridge). */
  path: z.string().optional(),
  pick: extendPickSchema.optional(),
});

const collaborationSchema = z.object({
  strategy: z.enum(['merge', 'lock', 'last-wins']).default('merge'),
  lock_features: z.array(z.string()).default([]),
});

const conversionsSchema = z
  .object({
    commands_to_skills: z
      .object({
        'codex-cli': z.boolean().optional(),
      })
      .strict()
      .optional(),
    agents_to_skills: z
      .object({
        'gemini-cli': z.boolean().optional(),
        cline: z.boolean().optional(),
        'codex-cli': z.boolean().optional(),
        windsurf: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

/** Zod schema for agentsbridge.yaml config validation */
export const configSchema = z.object({
  version: z.literal(1),
  targets: z.array(targetSchema).default([...TARGET_IDS]),
  features: z.array(featureSchema).default([...VALID_FEATURES]),
  extends: z.array(extendSourceSchema).default([]),
  overrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  collaboration: collaborationSchema.default({ strategy: 'merge', lock_features: [] }),
  conversions: conversionsSchema,
});

export type ValidatedConfig = z.infer<typeof configSchema>;
