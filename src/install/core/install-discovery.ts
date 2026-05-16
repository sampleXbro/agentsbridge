/**
 * Choose manual, skill-pack, or native install discovery.
 *
 * Dispatch precedence:
 *   1. Explicit `--as <kind>`          → manual importer (classifier bypassed).
 *   2. Explicit `--target <id>`        → native importer (classifier bypassed).
 *   3. Multi-signal classifier:
 *      - `anthropic-skill-pack`        → aggregator → CanonicalFiles + extras.
 *      - `canonical-agentsmesh`        → existing native/slice path.
 *      - `tool-native` / `unknown`     → existing native/slice path.
 *
 * The classifier is only consulted when no override is set, which preserves
 * the locked decision that `--target` and `--as` always win.
 */
import { resolveManualDiscoveredForInstall } from '../manual/manual-install-discovery.js';
import { resolveDiscoveredForInstall } from '../run/run-install-discovery.js';
import { classifySource } from '../classify/classify-source.js';
import { aggregateAnthropicSkillPack } from '../../sources/anthropic-skill-pack/aggregate.js';
import { anthropicSkillPackSource } from '../../sources/anthropic-skill-pack/index.js';
import { featuresFromCanonical } from './discover-resources.js';
import type { ExtendPick } from '../../config/core/schema.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';
import type { Classification } from '../classify/types.js';
import type { AggregateResult } from '../../sources/anthropic-skill-pack/aggregate.js';
import type { CanonicalFiles } from '../../core/types.js';

/**
 * Minimal `prep` shape consumed by the install executor. Both the manual
 * (`resolveManualDiscoveredForInstall`) and native
 * (`resolveDiscoveredForInstall`) discovery functions return supersets of
 * this; the new skill-pack branch returns the same minimal shape.
 */
export interface InstallDiscoveryPrep {
  readonly yamlTarget?: string;
  readonly scopedFeatures?: string[];
  readonly cleanup?: () => Promise<void>;
}

export interface InstallDiscoveryResult {
  prep: InstallDiscoveryPrep;
  implicitPick: ExtendPick | undefined;
  narrowed: CanonicalFiles;
  discoveredFeatures: string[];
  /** Present when the classifier ran (no override). */
  classification?: Classification;
  /** Present only for `anthropic-skill-pack`; carries broken-links + dedups. */
  aggregate?: AggregateResult;
}

function aggregateToCanonical(aggregate: AggregateResult): CanonicalFiles {
  return {
    rules: [...aggregate.rules],
    commands: [...aggregate.commands],
    agents: [...aggregate.agents],
    skills: [...aggregate.skills],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function emptyPrep(): InstallDiscoveryPrep {
  return {};
}

export async function resolveInstallDiscovery(args: {
  resolvedPath: string;
  contentRoot: string;
  pathInRepo: string;
  explicitTarget?: string;
  explicitAs?: ManualInstallAs;
  replayPick?: ExtendPick;
}): Promise<InstallDiscoveryResult> {
  if (args.explicitAs) {
    const manual = await resolveManualDiscoveredForInstall(
      args.contentRoot,
      args.explicitAs,
      args.explicitTarget,
      args.replayPick,
    );
    return { implicitPick: undefined, ...manual };
  }

  if (args.explicitTarget) {
    return resolveDiscoveredForInstall(
      args.resolvedPath,
      args.contentRoot,
      args.pathInRepo,
      args.explicitTarget,
    );
  }

  const classification = await classifySource(args.contentRoot);

  if (classification.type === 'anthropic-skill-pack') {
    const aggregate = await aggregateAnthropicSkillPack(args.contentRoot, anthropicSkillPackSource);
    const narrowed = aggregateToCanonical(aggregate);
    return {
      prep: emptyPrep(),
      implicitPick: undefined,
      narrowed,
      discoveredFeatures: featuresFromCanonical(narrowed),
      classification,
      aggregate,
    };
  }

  const native = await resolveDiscoveredForInstall(
    args.resolvedPath,
    args.contentRoot,
    args.pathInRepo,
    args.explicitTarget,
  );
  return { ...native, classification };
}
