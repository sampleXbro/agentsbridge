/**
 * agentsmesh install orchestration.
 */

import { join } from 'node:path';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { loadCanonicalWithExtends } from '../../canonical/extends/extends.js';
import { loadScopedConfig } from '../../config/core/scope.js';
import { logger } from '../../utils/output/logger.js';
import { exists } from '../../utils/filesystem/fs.js';
import { runGenerate } from '../../cli/commands/generate.js';
import { resolveInstallResolvedPath } from './run-install-resolve.js';
import { isGitAvailable } from '../source/git-pin.js';
import {
  hasInstallableResources,
  resolveAgentPool,
  resolveCommandPool,
  resolveRulePool,
  resolveSkillPool,
} from '../core/pool-resolution.js';
import { resolveInstallConflicts } from '../core/install-conflicts.js';
import { parseInstallSource } from '../source/url-parser.js';
import {
  buildInstallPick,
  deriveInstallFeatures,
  ensureInstallSelection,
  pickForSelectedResources,
} from '../core/install-entry-selection.js';
import { ruleSlug } from '../core/validate-resources.js';
import { writeInstallAsExtend } from '../core/install-extend-entry.js';
import { installAsPack } from './run-install-pack.js';
import { maybeRunInstallSync } from './install-sync.js';
import { selectInstallEntryName } from '../core/install-name.js';
import { readInstallFlags } from '../core/install-flags.js';
import { resolveInstallDiscovery } from '../core/install-discovery.js';
import { applyReplayInstallScope, type InstallReplayScope } from './install-replay.js';
import { resolveManualInstallPersistence } from '../manual/manual-install-persistence.js';
export async function runInstall(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
  replay?: InstallReplayScope,
): Promise<void> {
  const {
    sync,
    dryRun,
    force,
    useExtends,
    explicitPath,
    explicitTarget,
    explicitAs,
    nameOverride,
  } = readInstallFlags(flags);
  const scope = flags.global === true ? 'global' : 'project';
  const sourceArg = args[0]?.trim();
  if (sync) {
    const { context } = await loadScopedConfig(projectRoot, scope);
    if (
      await maybeRunInstallSync({
        sync,
        canonicalDir: context.canonicalDir,
        reinstall: async (entry) => {
          const replayPaths = entry.paths && entry.paths.length > 0 ? entry.paths : [entry.path];
          for (const replayPath of replayPaths) {
            await runInstall(
              {
                ...(force ? { force: true } : {}),
                ...(dryRun ? { 'dry-run': true } : {}),
                ...(scope === 'global' ? { global: true } : {}),
                name: entry.name,
                ...(entry.target ? { target: entry.target } : {}),
                ...(replayPath ? { path: replayPath } : {}),
                ...(entry.as ? { as: entry.as } : {}),
              },
              [entry.source],
              projectRoot,
              { features: entry.features, pick: entry.pick },
            );
          }
        },
      })
    ) {
      return;
    }
  }

  if (!sourceArg) {
    throw new Error(
      'Missing source. Usage: agentsmesh install <source> [--path ...] [--target ...]',
    );
  }
  const tty = process.stdin.isTTY;
  if (!tty && !force && !dryRun) {
    throw new Error('Non-interactive terminal: use --force or --dry-run for agentsmesh install.');
  }
  const { config, context } = await loadScopedConfig(projectRoot, scope);
  const parsed = await parseInstallSource(sourceArg, context.configDir, explicitPath);
  if (parsed.kind !== 'local' && !(await isGitAvailable())) {
    throw new Error('git is required for remote installs. Please install git and try again.');
  }
  const { resolvedPath, sourceForYaml, version } = await resolveInstallResolvedPath(
    parsed,
    sourceArg,
  );
  const pathInRepo = parsed.pathInRepo.replace(/^\/+|\/+$/g, '');
  const contentRoot = pathInRepo ? join(resolvedPath, pathInRepo) : resolvedPath;
  if (!(await exists(contentRoot))) {
    throw new Error(`Install path does not exist: ${contentRoot}`);
  }
  const persisted = await resolveManualInstallPersistence({
    as: explicitAs,
    contentRoot,
    pathInRepo,
  });
  const { prep, implicitPick, narrowed, discoveredFeatures } = await resolveInstallDiscovery({
    resolvedPath,
    contentRoot,
    pathInRepo,
    explicitTarget,
    explicitAs,
    replayPick: replay?.pick,
  });
  try {
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
  } finally {
    if (prep.cleanup) {
      await prep.cleanup();
    }
  }
}
