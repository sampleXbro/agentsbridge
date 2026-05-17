/**
 * agentsmesh uninstall orchestration.
 *
 * Threads the install lock around the same plan → decide → apply → generate
 * pipeline used during install. Output mirrors `runInstall` so the CLI
 * dispatcher can route both commands through `handleResult`.
 *
 * Phases:
 *   1. Parse flags + names.
 *   2. Acquire install lock for the canonical dir.
 *   3. `planUninstall` against `installs.yaml` + `agentsmesh.yaml` extends.
 *   4. `gatherUninstallDecisions` — legacy migrate, detect drift, prompt.
 *      An `[a]bort` from the prompt short-circuits to exit 130 (no writes).
 *   5. `--dry-run`: log + return; never reach apply.
 *   6. `applyUninstall` per decision (`keep-modified` nulls out `packDir`).
 *   7. Final `runGenerate()` so `cleanupStaleGeneratedOutputs` evicts the
 *      now-orphaned target files. Skipped under `--keep-generated`.
 */

import { join } from 'node:path';
import { loadScopedConfig } from '../../config/core/scope.js';
import { acquireInstallLock } from '../lock/install-lock.js';
import { readInstallManifest } from '../core/install-manifest.js';
import { runPostOperationGenerate } from '../run/post-install-generate.js';
import { logger } from '../../utils/output/logger.js';
import { readLine } from '../prompts/prompt-io.js';
import { planUninstall, type UninstallRemovalPlan } from './plan-uninstall.js';
import { gatherUninstallDecisions } from './uninstall-decisions.js';
import { applyUninstall } from './apply-uninstall.js';
import { appliedEntry, buildSkipped, previewEntries } from './uninstall-result.js';
import type { PromptAdapter } from '../prompts/prompt-types.js';
import type { UninstallData, UninstallRemovedEntry } from '../../cli/command-result.js';

export interface UninstallCommandResult {
  exitCode: number;
  data: UninstallData;
}

function parseNames(args: readonly string[]): string[] {
  // Preserves duplicates so `planUninstall`'s `detectDuplicates` guard can
  // raise the documented "probably a typo or scripted-loop bug" error
  // instead of being silenced here.
  const out: string[] = [];
  for (const arg of args) {
    for (const part of arg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      out.push(part);
    }
  }
  return out;
}

function defaultAdapter(): PromptAdapter {
  return {
    ask: (prompt: string) => readLine(prompt),
    write: (chunk: string) => process.stdout.write(chunk),
  };
}

export interface RunUninstallOptions {
  /** Test seam: override the default stdin/stdout-backed modification prompt. */
  readonly promptAdapter?: PromptAdapter;
  /** Test seam: treat the run as interactive regardless of `process.stdin.isTTY`. */
  readonly assumeTty?: boolean;
}

export async function runUninstall(
  flags: Record<string, string | boolean>,
  args: readonly string[],
  projectRoot: string,
  options: RunUninstallOptions = {},
): Promise<UninstallCommandResult> {
  const scope: 'project' | 'global' = flags.global === true ? 'global' : 'project';
  const all = flags.all === true;
  const force = flags.force === true;
  const dryRun = flags['dry-run'] === true;
  const keepPack = flags['keep-pack'] === true;
  const keepGenerated = flags['keep-generated'] === true;
  const tty = options.assumeTty === true || process.stdin.isTTY;

  const names = parseNames(args);

  // Validation failures land here as `{ exitCode: 1 }` so they render via the
  // standard logger.error path and surface a useful message in `--json` mode.
  function validationFailure(message: string): UninstallCommandResult {
    logger.error(message);
    return {
      exitCode: 1,
      data: { scope, mode: 'uninstall', removed: [], skipped: [], dryRun },
    };
  }

  if (!all && names.length === 0) {
    return validationFailure(
      'Missing install name. Usage: agentsmesh uninstall <name>[,<name>...] [--all]',
    );
  }
  if (!tty && !force && !dryRun) {
    return validationFailure(
      'Non-interactive terminal: use --force or --dry-run for agentsmesh uninstall.',
    );
  }

  const { config, context } = await loadScopedConfig(projectRoot, scope);
  const lockRelease = await acquireInstallLock(context.canonicalDir);

  try {
    const installs = await readInstallManifest(context.canonicalDir);
    const packsDir = join(context.canonicalDir, 'packs');

    const plan = planUninstall({
      names,
      all,
      keepPack,
      keepGenerated,
      installs,
      extends: config.extends,
      packsDir,
    });

    const { decisions, aborted } = await gatherUninstallDecisions(plan.removals, packsDir, {
      adapter: options.promptAdapter ?? defaultAdapter(),
      warn: (m) => logger.warn(m),
      bypassPrompts: force || dryRun || !tty,
      keepPack,
    });

    if (aborted) {
      logger.warn('Uninstall aborted at modification prompt.');
      return {
        exitCode: 130,
        data: { scope, mode: 'uninstall', removed: [], skipped: [], dryRun },
      };
    }

    for (const removal of plan.removals) {
      for (const w of removal.warnings) logger.warn(w);
    }

    if (dryRun) {
      for (const d of decisions) logger.info(`[dry-run] Would uninstall pack "${d.plan.name}".`);
      return {
        exitCode: 0,
        data: {
          scope,
          mode: 'uninstall',
          removed: previewEntries(decisions, context.rootBase, packsDir),
          skipped: buildSkipped(plan.skipped),
          dryRun: true,
        },
      };
    }

    const configPath = join(context.configDir, 'agentsmesh.yaml');
    const removed: UninstallRemovedEntry[] = [];
    for (const d of decisions) {
      const effectivePlan: UninstallRemovalPlan =
        d.action === 'keep-modified' ? { ...d.plan, packDir: null } : d.plan;
      const applied = await applyUninstall({
        plan: effectivePlan,
        canonicalDir: context.canonicalDir,
        configPath,
        config,
      });
      removed.push(appliedEntry(d, applied, context.rootBase, packsDir));
    }

    if (!keepGenerated && removed.length > 0) {
      await runPostOperationGenerate('uninstall', scope, context.rootBase);
    } else if (keepGenerated && removed.length > 0) {
      logger.warn(
        '--keep-generated: target files derived from the removed pack(s) may be stale until the next generate.',
      );
    }

    return {
      exitCode: 0,
      data: {
        scope,
        mode: 'uninstall',
        removed,
        skipped: buildSkipped(plan.skipped),
        dryRun: false,
      },
    };
  } finally {
    await lockRelease();
  }
}
