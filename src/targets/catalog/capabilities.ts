import type { SupportLevel } from '../../core/result-types.js';

/** Serialization / projection variant for a canonical feature (see architecture review §3.3). */
export type FeatureFlavor =
  | 'standard'
  | 'workflows'
  | 'settings-embedded'
  | 'projected-skills'
  | 'gh-actions-lite'
  | string;

/** Normalized capability entry: support level plus optional serialization flavor. */
export interface TargetCapabilityValue {
  readonly level: SupportLevel;
  readonly flavor?: FeatureFlavor;
}

export type CapabilityFeatureKey =
  | 'rules'
  | 'commands'
  | 'agents'
  | 'skills'
  | 'mcp'
  | 'hooks'
  | 'ignore'
  | 'permissions';

/** Descriptor may still use legacy string levels until fully migrated — normalize on read. */
export type TargetCapabilityInput = SupportLevel | TargetCapabilityValue;

export function cap(level: SupportLevel, flavor?: FeatureFlavor): TargetCapabilityValue {
  return flavor !== undefined ? { level, flavor } : { level };
}

export function normalizeCapabilityValue(input: TargetCapabilityInput): TargetCapabilityValue {
  if (typeof input === 'string') {
    return { level: input };
  }
  return input;
}

export function normalizeTargetCapabilities(
  caps: Record<CapabilityFeatureKey, TargetCapabilityInput>,
): Record<CapabilityFeatureKey, TargetCapabilityValue> {
  return {
    rules: normalizeCapabilityValue(caps.rules),
    commands: normalizeCapabilityValue(caps.commands),
    agents: normalizeCapabilityValue(caps.agents),
    skills: normalizeCapabilityValue(caps.skills),
    mcp: normalizeCapabilityValue(caps.mcp),
    hooks: normalizeCapabilityValue(caps.hooks),
    ignore: normalizeCapabilityValue(caps.ignore),
    permissions: normalizeCapabilityValue(caps.permissions),
  };
}
