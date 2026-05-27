/**
 * Apply phase for a single refresh: invoke the install pipeline with
 * `forceFreshMaterialize: true` against the pack's recorded source/features,
 * then stamp `refreshed_at` on the installs.yaml row.
 *
 * `materializePack` (inside the install pipeline) owns atomic swap +
 * backup + restore + orphan recovery; refresh never reinvents these.
 */

import {
  readInstallManifest,
  upsertInstallManifestEntry,
  type InstallManifestEntry,
} from '../core/install-manifest.js';
import type { RefreshPlan } from './refresh-plan.js';
import type { FailurePhase } from './refresh-result.js';

export interface ApplySinglePackDeps {
  /**
   * Re-run install for the given entry against the new SHA, with
   * `forceFreshMaterialize: true`. Production wires this to a thin
   * orchestrator that reconstructs install args from the manifest entry
   * (see createRunInstallForRefresh in refresh-install-bridge.ts).
   */
  readonly runInstallForRefresh: (entry: InstallManifestEntry, newSha: string) => Promise<void>;
  /** Test seam: override `now` for deterministic timestamps. */
  readonly now?: () => string;
}

export interface ApplyResult {
  readonly success: boolean;
  readonly phase?: FailurePhase;
  readonly error?: string;
}

export async function applySinglePack(
  plan: RefreshPlan,
  canonicalDir: string,
  deps: ApplySinglePackDeps,
): Promise<ApplyResult> {
  // 1. Run install with forceFreshMaterialize
  try {
    await deps.runInstallForRefresh(plan.entry, plan.newSha);
  } catch (err) {
    return {
      success: false,
      phase: 'apply',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Stamp refreshed_at on the freshly-written installs.yaml row
  try {
    const now = (deps.now ?? (() => new Date().toISOString()))();
    const manifest = await readInstallManifest(canonicalDir);
    const updated = manifest.find((e) => e.name === plan.entry.name);
    if (updated === undefined) {
      return {
        success: false,
        phase: 'manifest-update',
        error: `Entry "${plan.entry.name}" not found after install`,
      };
    }
    await upsertInstallManifestEntry(canonicalDir, { ...updated, refreshed_at: now });
  } catch (err) {
    return {
      success: false,
      phase: 'manifest-update',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return { success: true };
}
