import type { ValidatedConfig } from '../../config/core/schema.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { logger } from '../../utils/output/logger.js';
import { runGenerate } from '../../cli/commands/generate.js';
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
import { selectInstallEntryName } from '../core/install-name.js';
import { applyReplayInstallScope, type InstallReplayScope } from './install-replay.js';
import type { ParsedInstallSource } from '../source/parse-install-source.js';
import type { ManualInstallPersistence } from '../manual/manual-install-persistence.js';
import type { ManualInstallAs } from '../manual/manual-install-mode.js';
import type { PrepareInstallDiscoveryResult } from '../core/prepare-install-discovery.js';
import type { ExtendPick } from '../../config/core/schema.js';
import type { CanonicalFiles } from '../../core/types.js';

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
  prep: PrepareInstallDiscoveryResult;
  implicitPick: ExtendPick | undefined;
  narrowed: CanonicalFiles;
  discoveredFeatures: string[];
}

export async function executeRunInstallPoolsAndWrite(args: RunInstallExecuteArgs): Promise<void> {
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
  const entryName = selectInstallEntryName({
    config,
    parsed,
    entryFeatures,
    nameOverride,
  });
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
    if (dryRun) return;
  } else {
    if (dryRun) {
      logger.info(
        `[dry-run] Would install pack "${entryName}" to ${scope === 'global' ? '~/.agentsmesh/packs/.' : '.agentsmesh/packs/.'}`,
      );
      return;
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
      renameExistingPack: nameOverride === '',
    });
  }
  const genCode = await runGenerate(scope === 'global' ? { global: true } : {}, context.rootBase);
  if (genCode !== 0) {
    logger.warn(
      `Generate failed after install. Fix the issue and run agentsmesh generate${scope === 'global' ? ' --global' : ''}.`,
    );
  }
}
