/**
 * Aggregated outcome of an install run (single-pack or marketplace).
 *
 * `InstallReport` accumulates per-run diagnostics that flow from the install
 * pipeline to the CLI renderer and the `--json` envelope. Step 1 populates
 * `brokenResources` only; later steps add `subPackFailures` and
 * `candidatesNotPicked` as the picker and marketplace dispatcher land.
 */

export type BrokenResourceKind = 'frontmatter' | 'skill-dir' | 'unsupported-extension';

export interface BrokenResource {
  /** Source file or skill-directory path that was skipped. */
  path: string;
  kind: BrokenResourceKind;
  /** Human-readable cause; the YAML or filesystem error message. */
  reason: string;
}

export interface SubPackFailure {
  /** Sub-pack name and slug for the row in `installs.yaml`. */
  name: string;
  path: string;
  error: string;
}

export interface InstallReport {
  brokenResources: BrokenResource[];
  /** Populated by the marketplace dispatcher (step 4). */
  subPackFailures: SubPackFailure[];
}

export function createInstallReport(): InstallReport {
  return { brokenResources: [], subPackFailures: [] };
}
