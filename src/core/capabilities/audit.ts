import type { CapabilityFeatureKey } from '../../targets/catalog/capabilities.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import type { SupportLevel } from '../result-types.js';
import { TARGET_IDS } from '../../targets/catalog/target-ids.js';
import { getTargetCapabilities } from '../../targets/catalog/builtin-targets.js';
import { CAPABILITY_FEATURES, CAPABILITY_SCOPES, LEVEL_RANK } from './ledger-types.js';
import type { CapabilityLedger, LedgerCell } from './ledger-types.js';

export interface GapRow {
  readonly target: string;
  readonly feature: CapabilityFeatureKey;
  readonly scope: TargetLayoutScope;
  readonly from: SupportLevel;
  readonly to: SupportLevel;
  readonly source: readonly string[];
}

export type StaleReason = 'unverified' | 'expired' | 'over-declared';

export interface StaleRow {
  readonly target: string;
  readonly feature: CapabilityFeatureKey;
  readonly scope: TargetLayoutScope;
  readonly verifiedAt: string | null;
  readonly reason: StaleReason;
}

export interface MissingRow {
  readonly target: string;
  readonly feature: CapabilityFeatureKey;
  readonly scope: TargetLayoutScope;
  readonly level: SupportLevel;
}

export interface AuditReport {
  readonly gaps: readonly GapRow[];
  readonly stale: readonly StaleRow[];
  readonly missing: readonly MissingRow[];
}

export interface AuditInput {
  readonly ledger: CapabilityLedger;
  readonly today: string;
  readonly staleDays: number;
  readonly targetIds?: readonly string[];
}

function cellKey(target: string, feature: string, scope: string): string {
  return `${target}::${feature}::${scope}`;
}

function descriptorLevel(
  target: string,
  feature: CapabilityFeatureKey,
  scope: TargetLayoutScope,
): SupportLevel {
  return getTargetCapabilities(target, scope)?.[feature]?.level ?? 'none';
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return Math.floor((to - from) / 86_400_000);
}

export function auditCapabilities(input: AuditInput): AuditReport {
  const { ledger, today, staleDays } = input;
  const targets = input.targetIds ?? TARGET_IDS;
  const byKey = new Map<string, LedgerCell>(
    ledger.cells.map((c) => [cellKey(c.target, c.feature, c.scope), c]),
  );

  const gaps: GapRow[] = [];
  const stale: StaleRow[] = [];
  const missing: MissingRow[] = [];

  for (const target of targets) {
    for (const scope of CAPABILITY_SCOPES) {
      for (const feature of CAPABILITY_FEATURES) {
        const current = descriptorLevel(target, feature, scope);
        const cell = byKey.get(cellKey(target, feature, scope));

        if (cell === undefined) {
          if (current === 'native' || current === 'embedded') {
            missing.push({ target, feature, scope, level: current });
          }
          continue;
        }

        if (cell.verdict !== 'rejected' && LEVEL_RANK[current] < LEVEL_RANK[cell.maxAchievable]) {
          gaps.push({ target, feature, scope, from: current, to: cell.maxAchievable, source: cell.source });
        }

        if (cell.verifiedAt === null) {
          stale.push({ target, feature, scope, verifiedAt: null, reason: 'unverified' });
        } else if (cell.verdict === 'confirmed' && daysBetween(cell.verifiedAt, today) > staleDays) {
          stale.push({ target, feature, scope, verifiedAt: cell.verifiedAt, reason: 'expired' });
        } else if (LEVEL_RANK[current] > LEVEL_RANK[cell.maxAchievable]) {
          stale.push({ target, feature, scope, verifiedAt: cell.verifiedAt, reason: 'over-declared' });
        }
      }
    }
  }

  return { gaps, stale, missing };
}
