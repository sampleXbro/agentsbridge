import type { ValidatedConfig } from '../../config/core/schema.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { logger } from '../../utils/output/logger.js';
import { runPostOperationGenerate } from './post-install-generate.js';
import {
  hasInstallableResources,
  resolveAgentPool,
  resolveCommandPool,
  resolveRulePool,
  resolveSkillPool,
} from '../core/pool-resolution.js';
import { resolveInstallConflicts } from '../core/install-conflicts.js';
import {
  buildInstallPick,
  deriveInstallFeatures,
  ensureInstallSelection,
  pickForSelectedResources,
} from '../core/install-entry-selection.js';
import { ruleSlug } from '../core/validate-resources.js';
import { writeInstallAsExtend } from '../core/install-extend-entry.js';
import { installAsPack } from './run-install-pack.js';
import { findExistingInstallName, selectInstallEntryName } from '../core/install-name.js';
import { readInstallManifest, type InstallManifestEntry } from '../core/install-manifest.js';
import { applyReplayInstallScope, type InstallReplayScope } from './install-replay.js';
import { buildInstalledList, buildSkippedList } from './run-install-result.js';
import type { ParsedInstallSource } from '../source/parse-install-source.js';
import type { ManualInstallPersistence } from '../manual/manual-install-persistence.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';
import type { ExtendPick } from '../../config/core/schema.js';
import type { CanonicalFiles } from '../../core/types.js';
import type { InstallDiscoveryPrep } from '../core/install-discovery.js';

export interface RunInstallExecuteArgs {
  scope: 'global' | 'project';
  force: boolean;
  dryRun: boolean;
  tty: boolean;
  useExtends: boolean;
  nameOverride: string;
  explicitAs?: ManualInstallAs;
  config: ValidatedConfig;
  context: { configDir: string; canonicalDir: string; rootBase: string };
  parsed: ParsedInstallSource;
  sourceForYaml: string;
  version: string | undefined;
  pathInRepo: string;
  persisted: ManualInstallPersistence;
  replay?: InstallReplayScope;
  prep: InstallDiscoveryPrep;
  implicitPick: ExtendPick | undefined;
  narrowed: CanonicalFiles;
  discoveredFeatures: string[];
  /** Classifier verdict (e.g. `anthropic-skill-pack`); recorded in install manifest. */
  sourceType?: string;
}

export interface InstallExecuteResult {
  installed: Array<{ kind: string; name: string; path: string }>;
  skipped: Array<{ kind: string; name: string; reason: string }>;
}

export async function executeRunInstallPoolsAndWrite(
  args: RunInstallExecuteArgs,
): Promise<InstallExecuteResult> {
  const {
    scope,
    force,
    dryRun,
    tty,
    useExtends,
    nameOverride,
    explicitAs,
    config,
    context,
    parsed,
    sourceForYaml,
    version,
    pathInRepo,
    persisted,
    replay,
    prep,
    implicitPick,
    narrowed,
    discoveredFeatures,
    sourceType,
  } = args;

  const { narrowed: effectiveNarrowed, discoveredFeatures: effectiveFeatures } =
    applyReplayInstallScope(narrowed, discoveredFeatures, replay);
  if (!hasInstallableResources(effectiveNarrowed)) {
    throw new Error(
      implicitPick || prep.scopedFeatures
        ? 'No resources match the install path or implicit selection (check pick names exist at that path).'
        : 'No supported resources found to install (skills, rules, commands, agents).',
    );
  }
  const skillsPool = await resolveSkillPool(effectiveNarrowed, force, dryRun, tty);
  const rulesPool = await resolveRulePool(effectiveNarrowed, force, dryRun, tty);
  const commandsPool = await resolveCommandPool(effectiveNarrowed, force, dryRun, tty);
  const agentsPool = await resolveAgentPool(effectiveNarrowed, force, dryRun, tty);
  const preConflict = {
    skills: skillsPool.length,
    rules: rulesPool.length,
    commands: commandsPool.length,
    agents: agentsPool.length,
  };
  const { canonical: merged } = await loadCanonicalWithExtends(
    config,
    context.configDir,
    {},
    context.canonicalDir,
  );
  const selected =
    !force && !dryRun && tty
      ? await resolveInstallConflicts(merged, {
          skills: skillsPool,
          rules: rulesPool,
          commands: commandsPool,
          agents: agentsPool,
        })
      : {
          skillNames: skillsPool.map((s) => s.name),
          ruleSlugs: rulesPool.map((r) => ruleSlug(r)),
          commandNames: commandsPool.map((c) => c.name),
          agentNames: agentsPool.map((a) => a.name),
        };
  ensureInstallSelection({ selected, discoveredFeatures: effectiveFeatures, preConflict });
  const entryFeatures = (replay?.features ??
    deriveInstallFeatures(effectiveFeatures, selected)) as ValidatedConfig['features'];
  if (entryFeatures.length === 0) {
    throw new Error('No features left to install after selection.');
  }
  const pick =
    pickForSelectedResources(replay?.pick, selected) ??
    persisted.pick ??
    buildInstallPick({
      pathInRepo: persisted.pathInRepo ?? pathInRepo,
      implicitPick,
      preConflictCounts: preConflict,
      selected,
    });
  const installManifest = await readInstallManifest(context.canonicalDir);
  const reuseExistingName = pickReuseEntryName({
    manifest: installManifest,
    parsed,
    entryFeatures,
    yamlTarget: prep.yamlTarget,
    explicitAs,
  });
  const entryName = selectInstallEntryName({
    config,
    parsed,
    entryFeatures,
    nameOverride: nameOverride || reuseExistingName || '',
  });

  const installed = buildInstalledList(selected, entryName);
  const skipped = buildSkippedList(skillsPool, rulesPool, commandsPool, agentsPool, selected);

  if (useExtends) {
    await writeInstallAsExtend({
      configDir: context.configDir,
      config,
      entryArgs: {
        name: entryName,
        source: sourceForYaml,
        version,
        features: entryFeatures,
        path: persisted.pathInRepo,
        pick,
        yamlTarget: prep.yamlTarget,
      },
      dryRun,
    });
    if (dryRun) return { installed, skipped };
  } else {
    if (dryRun) {
      logger.info(
        `[dry-run] Would install pack "${entryName}" to ${scope === 'global' ? '~/.agentsmesh/packs/.' : '.agentsmesh/packs/.'}`,
      );
      return { installed, skipped };
    }
    await installAsPack({
      canonicalDir: context.canonicalDir,
      packName: entryName,
      narrowed: effectiveNarrowed,
      selected,
      sourceForYaml,
      version,
      sourceKind: parsed.kind,
      entryFeatures,
      pick,
      yamlTarget: prep.yamlTarget,
      pathInRepo: persisted.pathInRepo,
      manualAs: explicitAs,
      renameExistingPack: nameOverride === '' && reuseExistingName === null,
      sourceType,
    });
  }
  await runPostOperationGenerate('install', scope, context.rootBase);
  return { installed, skipped };
}

function sameFeaturesSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

/**
 * Returns the existing install entry's persisted name when re-installing the
 * same source under a different URL spelling and with matching scope
 * (target / as / features). When the matching entry's scope differs, returns
 * `null` so the existing feature-variant pack naming behavior is preserved.
 */
function pickReuseEntryName(args: {
  manifest: readonly InstallManifestEntry[];
  parsed: ParsedInstallSource;
  entryFeatures: readonly string[];
  yamlTarget: string | undefined;
  explicitAs: ManualInstallAs | undefined;
}): string | null {
  const { manifest, parsed, entryFeatures, yamlTarget, explicitAs } = args;
  const candidateName = findExistingInstallName(manifest, parsed);
  if (candidateName === null) return null;
  const candidate = manifest.find((entry) => entry.name === candidateName);
  if (!candidate) return null;
  if (candidate.target !== yamlTarget) return null;
  if (candidate.as !== explicitAs) return null;
  if (!sameFeaturesSet(candidate.features, entryFeatures)) return null;
  return candidate.name;
}
