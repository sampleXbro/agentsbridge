/**
 * Plan phase for `agentsmesh refresh`. Reads installs.yaml, re-resolves
 * each pack's source/ref, detects drift, and classifies the pack.
 * Writes nothing.
 */

import { join } from 'node:path';
import type { ModifiedFile } from '../uninstall/detect-modified.js';
import { detectModifiedFiles } from '../uninstall/detect-modified.js';
import type { InstallManifestEntry } from '../core/install-manifest.js';
import { readFileSafe, exists } from '../../utils/filesystem/fs.js';
import { INSTALL_MANIFEST_FILENAME } from '../manifest/install-manifest-hash.js';
import type { FailurePhase } from './refresh-result.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RefreshClassification =
  | 'unchanged' // no drift, ref didn't move
  | 'clean-update' // no drift, ref moved
  | 'needs-consent' // local drift; user must consent
  | 'error'; // plan-phase failure

export interface RefreshPlan {
  readonly name: string;
  readonly entry: InstallManifestEntry;
  readonly oldSha: string | null;
  readonly newSha: string;
  readonly modifications: readonly ModifiedFile[];
  readonly classification: RefreshClassification;
  readonly error?: { readonly phase: FailurePhase; readonly message: string };
}

export interface ClassifyArgs {
  readonly modifications: readonly ModifiedFile[];
  readonly oldSha: string | null;
  readonly newSha: string;
}

// ─── Classifier ───────────────────────────────────────────────────────────────

export function classifyRefreshPlan(args: ClassifyArgs): RefreshClassification {
  if (args.modifications.length > 0) return 'needs-consent';
  if (args.oldSha === args.newSha) return 'unchanged';
  return 'clean-update';
}

// ─── planSinglePack ───────────────────────────────────────────────────────────

export interface PlanSinglePackDeps {
  /**
   * Re-resolve the original source/ref to a new SHA. Injected as a dependency
   * so unit tests can mock network calls. Production wires this to
   * `resolveRemoteRefForInstall` for git sources and a no-op for local.
   */
  readonly resolveRef: (entry: InstallManifestEntry) => Promise<string>;
}

export async function planSinglePack(
  entry: InstallManifestEntry,
  packsDir: string,
  deps: PlanSinglePackDeps,
): Promise<RefreshPlan> {
  const packDir = join(packsDir, entry.name);
  const oldSha = entry.version ?? null;

  // Read pack manifest
  const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
  const manifestRaw = await readFileSafe(manifestPath);
  if (manifestRaw === null) {
    return {
      name: entry.name,
      entry,
      oldSha,
      newSha: oldSha ?? '',
      modifications: [],
      classification: 'error',
      error: { phase: 'plan', message: `Pack manifest missing at ${manifestPath}` },
    };
  }

  let manifestFiles: Record<string, string>;
  try {
    const parsed = JSON.parse(manifestRaw) as { files?: Record<string, string> };
    manifestFiles = parsed.files ?? {};
  } catch {
    return {
      name: entry.name,
      entry,
      oldSha,
      newSha: oldSha ?? '',
      modifications: [],
      classification: 'error',
      error: { phase: 'plan', message: `Pack manifest is corrupt at ${manifestPath}` },
    };
  }

  // Drift detection: only meaningful if the pack dir exists
  let modifications: readonly ModifiedFile[] = [];
  if (await exists(packDir)) {
    modifications = await detectModifiedFiles(packDir, manifestFiles);
  }

  // Re-resolve ref
  let newSha: string;
  try {
    newSha = await deps.resolveRef(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: entry.name,
      entry,
      oldSha,
      newSha: oldSha ?? '',
      modifications,
      classification: 'error',
      error: { phase: 'plan', message },
    };
  }

  return {
    name: entry.name,
    entry,
    oldSha,
    newSha,
    modifications,
    classification: classifyRefreshPlan({ modifications, oldSha, newSha }),
  };
}

// ─── createDefaultResolveRef ──────────────────────────────────────────────────

import { resolveRemoteRefForInstall } from '../source/git-pin.js';
import { parseSourceUrl } from '../source/parse-source-url.js';

/** Production wiring for `PlanSinglePackDeps.resolveRef`. */
export function createDefaultResolveRef(): PlanSinglePackDeps['resolveRef'] {
  return async (entry: InstallManifestEntry): Promise<string> => {
    if (entry.source_kind === 'local') return entry.version ?? 'local';
    const parsed = parseSourceUrl(entry.source);
    if (parsed === null || parsed.remoteUrl === undefined) {
      throw new Error(`Cannot parse source for refresh: ${entry.source}`);
    }
    return resolveRemoteRefForInstall(parsed.ref ?? 'HEAD', parsed.remoteUrl);
  };
}
