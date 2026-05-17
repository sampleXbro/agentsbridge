/**
 * Drive the per-pack decision loop for `agentsmesh uninstall`.
 *
 * For each `UninstallRemovalPlan` produced by `planUninstall`, this module:
 *   1. Migrates legacy packs (no manifest) to a baseline manifest so
 *      modification detection has something to compare against.
 *   2. Reads the install manifest's `files` map and computes drift via
 *      `detectModifiedFiles`.
 *   3. When drift is present and the pack will actually be removed (not
 *      `--keep-pack`), surfaces the modification prompt; `--force`,
 *      `--json`, non-TTY, and `--dry-run` all bypass it via the
 *      `delete-anyway` default.
 *
 * Returns one `RemovalDecision` per plan plus an `aborted` flag — when the
 * user picks `[a]bort` at the prompt, the loop short-circuits and the
 * orchestrator returns exit 130 without writing anything.
 *
 * The function does not touch the pack directory itself or yaml entries;
 * that responsibility lives in `apply-uninstall.ts`.
 */

import { join } from 'node:path';
import { exists, readFileSafe } from '../../utils/filesystem/fs.js';
import { INSTALL_MANIFEST_FILENAME } from '../manifest/install-manifest-hash.js';
import { migrateLegacyManifest } from './legacy-manifest-migration.js';
import { detectModifiedFiles, type ModifiedFile } from './detect-modified.js';
import {
  runModifiedFilesPrompt,
  type ModifiedFilesAction,
} from '../prompts/modified-files-prompt.js';
import type { UninstallRemovalPlan } from './plan-uninstall.js';
import type { PromptAdapter } from '../prompts/prompt-types.js';

export interface RemovalDecision {
  readonly plan: UninstallRemovalPlan;
  readonly modifications: readonly ModifiedFile[];
  readonly action: Exclude<ModifiedFilesAction, 'abort'>;
  readonly legacyMigrated: boolean;
  readonly packDirMissing: boolean;
}

export interface DecisionsResult {
  readonly decisions: readonly RemovalDecision[];
  readonly aborted: boolean;
}

export interface UninstallDecisionsDeps {
  readonly adapter: PromptAdapter;
  readonly warn: (msg: string) => void;
  /** When true, modification prompt is bypassed and defaults to `delete-anyway`. */
  readonly bypassPrompts: boolean;
  /** When true, prompts are still bypassed and pack dirs are not touched. */
  readonly keepPack: boolean;
}

async function readManifestFiles(
  packDir: string,
): Promise<Readonly<Record<string, string>> | null> {
  const content = await readFileSafe(join(packDir, INSTALL_MANIFEST_FILENAME));
  if (content === null) return null;
  try {
    const raw = JSON.parse(content) as { files?: Record<string, string> };
    return raw.files ?? {};
  } catch {
    return null;
  }
}

async function decideOne(
  plan: UninstallRemovalPlan,
  packsDir: string,
  deps: UninstallDecisionsDeps,
): Promise<RemovalDecision | 'abort'> {
  // Extends-only plans (`install --extends`) never materialized a pack dir;
  // skip the disk stat, legacy migration, and modification detection. The
  // `--keep-pack` case keeps `plan.packDir === null` even when the pack IS
  // on disk, so discriminate on `manifestEntry` here.
  if (plan.manifestEntry === null) {
    return {
      plan,
      modifications: [],
      action: 'proceed',
      legacyMigrated: false,
      packDirMissing: false,
    };
  }

  const packDir = join(packsDir, plan.name);
  if (!(await exists(packDir))) {
    deps.warn(
      `Pack "${plan.name}" directory missing at ${packDir}; only manifest entries will be removed.`,
    );
    return {
      plan,
      modifications: [],
      action: 'proceed',
      legacyMigrated: false,
      packDirMissing: true,
    };
  }

  const migration = await migrateLegacyManifest(packDir, { warn: deps.warn });
  const legacyMigrated = migration !== null;

  const manifestFiles = await readManifestFiles(packDir);
  if (manifestFiles === null) {
    return { plan, modifications: [], action: 'proceed', legacyMigrated, packDirMissing: false };
  }

  const modifications = await detectModifiedFiles(packDir, manifestFiles);

  // `--keep-pack`: report modifications in the decision so the JSON result
  // reflects *why* the user might have asked to keep the pack, but bypass the
  // prompt and never delete. Pack-dir removal is gated by `plan.packDir`
  // (which is `null` under `--keep-pack`) in `applyUninstall`.
  if (deps.keepPack || modifications.length === 0) {
    return { plan, modifications, action: 'proceed', legacyMigrated, packDirMissing: false };
  }

  const promptResult = await runModifiedFilesPrompt(
    { packName: plan.name, modifications },
    { bypass: deps.bypassPrompts },
    deps.adapter,
  );
  if (promptResult.action === 'abort') return 'abort';
  return {
    plan,
    modifications,
    action: promptResult.action,
    legacyMigrated,
    packDirMissing: false,
  };
}

export async function gatherUninstallDecisions(
  plans: readonly UninstallRemovalPlan[],
  packsDir: string,
  deps: UninstallDecisionsDeps,
): Promise<DecisionsResult> {
  const decisions: RemovalDecision[] = [];
  for (const plan of plans) {
    const next = await decideOne(plan, packsDir, deps);
    if (next === 'abort') return { decisions, aborted: true };
    decisions.push(next);
  }
  return { decisions, aborted: false };
}
