import type { SupportLevel } from '../result-types.js';
import type { CapabilityFeatureKey } from '../../targets/catalog/capabilities.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export type LedgerFormat = 'json' | 'yaml' | 'toml' | 'md-frontmatter' | 'text';
export type LedgerVerdict = 'confirmed' | 'rejected' | 'unverified';

export interface KeyCheck {
  readonly pointer: string; // JSON-pointer-ish; a `*` segment iterates object values / array items
  readonly kind: 'object' | 'array' | 'string' | 'number' | 'boolean';
  readonly anyOf?: readonly string[]; // at least one of these child keys must be present
}

export interface Fingerprint {
  readonly topLevelKeys: readonly string[];
  readonly requiredFrontmatter: readonly string[];
  readonly keyChecks: readonly KeyCheck[];
}

export interface LedgerCell {
  readonly target: string;
  readonly feature: CapabilityFeatureKey;
  readonly scope: TargetLayoutScope;
  readonly maxAchievable: SupportLevel;
  readonly path: string;
  readonly ext: string;
  readonly format: LedgerFormat;
  readonly fingerprint: Fingerprint;
  readonly source: readonly string[];
  readonly verifiedAt: string | null;
  readonly verdict: LedgerVerdict;
  readonly rejectionReason: string | null;
}

export interface CapabilityLedger {
  readonly cells: readonly LedgerCell[];
}

export const LEVEL_RANK: Record<SupportLevel, number> = {
  none: 0,
  partial: 1,
  embedded: 2,
  native: 3,
};

export const CAPABILITY_FEATURES: readonly CapabilityFeatureKey[] = [
  'rules',
  'additionalRules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
];

export const CAPABILITY_SCOPES: readonly TargetLayoutScope[] = ['project', 'global'];
