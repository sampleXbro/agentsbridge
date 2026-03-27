import type { SupportLevel } from '../types.js';
import { TARGET_IDS, TARGET_CATALOG } from '../../targets/catalog/target-catalog.js';

const FEATURE_IDS = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
] as const;

/** PRD-defined support: feature -> target -> level */
export const SUPPORT_MATRIX: Record<string, Record<string, SupportLevel>> = Object.fromEntries(
  FEATURE_IDS.map((feature) => [
    feature,
    Object.fromEntries(
      TARGET_IDS.map((target) => [target, TARGET_CATALOG[target].capabilities[feature]]),
    ),
  ]),
) as Record<string, Record<string, SupportLevel>>;

export const LEVEL_SYMBOL: Record<SupportLevel, string> = {
  native: '✓',
  embedded: '📝',
  partial: '⚠',
  none: '–',
};
