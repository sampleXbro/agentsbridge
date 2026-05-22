/**
 * Contract between `selectInstallCandidates()` (step 3) and the install
 * executor. One `InstallTarget` becomes one row in `installs.yaml`.
 *
 * Step 1 ships the type so the surrounding plumbing (`InstallReport`,
 * `InstallData`, the CLI renderer) can reference it without a follow-up
 * schema change when the picker lands in step 3.
 */

import type { ManualInstallAs } from '../manual/manual-install-mode.js';

export type CanonicalFeature = 'rules' | 'commands' | 'agents' | 'skills';

export interface InstallTarget {
  /** Auto-generated row name: `<owner>-<repo>-<subpath-slug>`. */
  name: string;
  /** Resolved source URL plus SHA, as it appears in `installs.yaml`. */
  source: string;
  /** Source-root-relative path; undefined when installing from the source root. */
  path?: string;
  /** Manual install kind override; set when the picker matched a flat collection. */
  as?: ManualInstallAs;
  /** Native target ID; set for tool-native flat dirs (e.g. `cursor` for `.mdc`). */
  target?: string;
  /** Detected feature kinds populated by `layout-detect` (step 2). */
  features?: CanonicalFeature[];
}
