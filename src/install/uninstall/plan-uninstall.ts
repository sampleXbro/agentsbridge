/**
 * Compute the per-install removal plan for `agentsmesh uninstall`.
 *
 * Inputs are pure data: the current `installs.yaml` entries, the
 * `agentsmesh.yaml` `extends:` list, and the user-supplied flag set. The
 * function does NOT touch disk, does NOT prompt, and does NOT apply the
 * removals — the run-uninstall orchestrator (P11) consumes this plan and
 * routes it through the modification prompt, lock, and file system.
 *
 * The plan answers four questions for each requested name:
 *   1. Does the pack directory get rm-rf'd? (false when `--keep-pack`)
 *   2. Which `installs.yaml` entry gets removed? (always present)
 *   3. Which `agentsmesh.yaml` `extends:` entry gets removed? (the one whose
 *      `name` matches the install name, or null when no extends entry shares
 *      the name)
 *   4. Does post-uninstall `generate` clean stale target artifacts?
 *      (false when `--keep-generated`; a warning is attached so callers can
 *      tell the user that target trees may be left with orphaned files)
 *
 * Names that do not match any install are returned in `skipped`. Duplicate
 * requests are an error - they probably indicate a typo or scripted-loop
 * bug and silently de-duplicating them masks user intent.
 */

import { join } from 'node:path';
import type { InstallManifestEntry } from '../core/install-manifest.js';
import type { ValidatedConfig } from '../../config/core/schema.js';

type ExtendEntry = ValidatedConfig['extends'][number];

export interface PlanUninstallArgs {
  /** User-supplied install names (`uninstall foo,bar`). Empty when `--all` is true. */
  readonly names: readonly string[];
  /** When true, ignore `names` and plan a removal for every install. */
  readonly all: boolean;
  /** When true, leave the pack directory on disk; only drop yaml/extends entries. */
  readonly keepPack: boolean;
  /** When true, do not let post-uninstall generate clean stale target artifacts. */
  readonly keepGenerated: boolean;
  /** Current contents of `<canonicalDir>/installs.yaml`. */
  readonly installs: readonly InstallManifestEntry[];
  /** Current `agentsmesh.yaml` extends list. */
  readonly extends: readonly ExtendEntry[];
  /** Absolute path to `<canonicalDir>/packs/`. */
  readonly packsDir: string;
}

export interface UninstallRemovalPlan {
  readonly name: string;
  /** Absolute path to the pack dir to remove, or `null` when `--keep-pack`. */
  readonly packDir: string | null;
  /** The installs.yaml entry that must be dropped. */
  readonly manifestEntry: InstallManifestEntry;
  /** Matching extends entry (by name), or `null` when none. */
  readonly extendsEntry: ExtendEntry | null;
  /** Whether the post-uninstall generate pass should clean stale target files. */
  readonly removeGenerated: boolean;
  /** Plan-time advisories attached to this removal. */
  readonly warnings: readonly string[];
}

export interface PlanUninstallResult {
  readonly removals: readonly UninstallRemovalPlan[];
  /** User-supplied names that did not match any installs.yaml entry. */
  readonly skipped: readonly string[];
}

function detectDuplicates(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) dups.add(name);
    else seen.add(name);
  }
  return [...dups];
}

function buildPlan(
  manifestEntry: InstallManifestEntry,
  args: PlanUninstallArgs,
  extendsByName: ReadonlyMap<string, ExtendEntry>,
): UninstallRemovalPlan {
  const warnings: string[] = [];
  if (args.keepGenerated) {
    warnings.push(
      `--keep-generated: target trees will not be re-rendered; generated files derived from "${manifestEntry.name}" may remain stale until the next generate.`,
    );
  }
  return {
    name: manifestEntry.name,
    packDir: args.keepPack ? null : join(args.packsDir, manifestEntry.name),
    manifestEntry,
    extendsEntry: extendsByName.get(manifestEntry.name) ?? null,
    removeGenerated: !args.keepGenerated,
    warnings,
  };
}

/**
 * Compute the removal plan for an uninstall invocation.
 *
 * @throws When `names` is empty and `--all` is false (the CLI front-end is
 *   expected to enforce this; we double-check so library callers cannot
 *   silently no-op).
 * @throws When `names` contains duplicate entries.
 * @throws When `--all` and the installs list contains duplicate names (the
 *   manifest is corrupt; surface it loudly rather than over-uninstall).
 */
export function planUninstall(args: PlanUninstallArgs): PlanUninstallResult {
  if (!args.all && args.names.length === 0) {
    throw new Error('uninstall: must provide at least one name or pass --all.');
  }

  const extendsByName = new Map<string, ExtendEntry>();
  for (const ext of args.extends) {
    if (!extendsByName.has(ext.name)) extendsByName.set(ext.name, ext);
  }

  if (args.all) {
    const installNames = args.installs.map((entry) => entry.name);
    const dups = detectDuplicates(installNames);
    if (dups.length > 0) {
      throw new Error(
        `uninstall --all: installs.yaml has duplicate names: ${dups.join(', ')}. Manifest is corrupt; remove the duplicates before retrying.`,
      );
    }
    const removals = args.installs.map((entry) => buildPlan(entry, args, extendsByName));
    return { removals, skipped: [] };
  }

  const userDups = detectDuplicates(args.names);
  if (userDups.length > 0) {
    throw new Error(`uninstall: duplicate names requested: ${userDups.join(', ')}.`);
  }

  const installsByName = new Map<string, InstallManifestEntry>();
  for (const entry of args.installs) installsByName.set(entry.name, entry);

  const removals: UninstallRemovalPlan[] = [];
  const skipped: string[] = [];
  for (const name of args.names) {
    const entry = installsByName.get(name);
    if (entry === undefined) {
      skipped.push(name);
      continue;
    }
    removals.push(buildPlan(entry, args, extendsByName));
  }

  return { removals, skipped };
}
