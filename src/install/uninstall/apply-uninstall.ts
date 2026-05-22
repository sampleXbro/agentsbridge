/**
 * Execute one `UninstallRemovalPlan` against disk.
 *
 * Pure-ish: writes to (or removes from) three locations — the pack
 * directory, `installs.yaml`, and `agentsmesh.yaml` — and returns a
 * `AppliedRemoval` describing exactly what landed. Does not prompt, does
 * not detect modifications, does not run generate. The orchestrator
 * (`run-uninstall.ts`) is responsible for choosing whether `packDir` is
 * `null` (e.g. user picked `[k]eep-modified` at the prompt or passed
 * `--keep-pack`) before calling us.
 *
 * Behavior contract:
 *   1. If `plan.packDir` is not null AND the directory exists on disk,
 *      remove it recursively. The flag tracks whether bytes were actually
 *      removed (`packDirRemoved = true`) so `--keep-pack`, missing pack,
 *      and `[k]eep-modified` all surface as `false` in the result.
 *   2. Always attempt to drop the `installs.yaml` entry. The boolean
 *      tracks whether a row was found and rewritten.
 *   3. If `plan.extendsEntry` is non-null, attempt to drop the matching
 *      `extends:` row from `agentsmesh.yaml`. Returns whether a row was
 *      found. When the plan says no extends row matched, we skip the
 *      file read entirely.
 *
 * Atomicity: each yaml rewrite uses `writeFileAtomic`. A crash between
 * step 1 and step 2 leaves the pack dir gone but the entry still listed —
 * the next `agentsmesh uninstall` re-runs cleanly because step 1 is
 * idempotent (already-gone is a no-op) and step 2 still finds the entry.
 */

import { rm } from 'node:fs/promises';
import { exists } from '../../utils/filesystem/fs.js';
import { removeInstallManifestEntry } from '../core/install-manifest.js';
import { removeAgentsmeshExtendByName } from '../core/remove-extend-entry.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { UninstallRemovalPlan } from './plan-uninstall.js';

export interface AppliedRemoval {
  readonly name: string;
  readonly packDirRemoved: boolean;
  readonly manifestEntryRemoved: boolean;
  readonly extendsEntryRemoved: boolean;
  /**
   * True when at least one expected removal step did not land. JSON consumers
   * (CI, scripts) use this to distinguish a fully-clean uninstall from a
   * silent partial one (e.g. `installs.yaml` updated but the extends row
   * never matched, or `--keep-pack` preserved bytes by design).
   */
  readonly partial: boolean;
}

export interface ApplyUninstallArgs {
  readonly plan: UninstallRemovalPlan;
  readonly canonicalDir: string;
  readonly configPath: string;
  readonly config: ValidatedConfig;
}

export async function applyUninstall(args: ApplyUninstallArgs): Promise<AppliedRemoval> {
  const { plan, canonicalDir, configPath, config } = args;

  let packDirRemoved = false;
  if (plan.packDir !== null && (await exists(plan.packDir))) {
    // No `force: true`: the `exists()` guard above already handles ENOENT.
    // Without `force` real I/O errors (EACCES, EBUSY) surface to the caller
    // instead of being silently swallowed, and the uninstall fails loudly
    // rather than reporting `packDirRemoved: true` on a half-deleted tree.
    await rm(plan.packDir, { recursive: true });
    packDirRemoved = true;
  }

  const manifestEntryRemoved = await removeInstallManifestEntry(canonicalDir, plan.name);

  let extendsEntryRemoved = false;
  if (plan.extendsEntry !== null) {
    extendsEntryRemoved = await removeAgentsmeshExtendByName(configPath, config, plan.name);
  }

  // "Partial" = at least one expected step did not land. Each expected step is:
  //   - pack dir removal (skipped when plan.packDir is null OR pack absent on disk)
  //   - manifest entry removal (extends-only installs have no row → not expected)
  //   - extends entry removal (only expected when plan.extendsEntry is non-null)
  const packExpected = plan.packDir !== null;
  const manifestExpected = plan.manifestEntry !== null;
  const extendsExpected = plan.extendsEntry !== null;
  const partial =
    (packExpected && !packDirRemoved) ||
    (manifestExpected && !manifestEntryRemoved) ||
    (extendsExpected && !extendsEntryRemoved);

  return {
    name: plan.name,
    packDirRemoved,
    manifestEntryRemoved,
    extendsEntryRemoved,
    partial,
  };
}
