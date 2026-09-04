/**
 * The `.aider.conf.yml` projection and its two emitters.
 *
 * Two canonical features land in this one file: `rules` contributes the `read:`
 * wiring (aider does not auto-load `CONVENTIONS.md`) and `hooks` contributes
 * aider's five command keys. They are projected together so the file has a
 * single writer per run and the shared merge (`mergeAiderConf`) can be
 * key-scoped against whatever the user already had there.
 *
 * The emitters split on file access, not on scope:
 *   - `emitAiderConf` is synchronous and runs through the generate engine's
 *     merge hook, so it handles every run that has something to write;
 *   - `clearAiderConf` reads the file, so it is the only one that can tell
 *     "delete the keys agentsmesh wrote" from "create an empty config file".
 *     It runs exactly when the projection is empty — a revoked last hook, or a
 *     global run, where `read:` is suppressed.
 */

import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { CanonicalFiles, GenerateResult } from '../../core/types.js';
import type { ScopeExtrasFn, TargetLayoutScope } from '../catalog/target-descriptor.js';
import { computeStatus } from '../../core/generate/feature-loop.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { hasManagedAiderKeys, mergeAiderConf } from './conf-merge.js';
import { buildAiderConventions } from './generator.js';
import { projectAiderHooks } from './hooks-format.js';
import { AIDER_TARGET, AIDER_CONF_FILE, AIDER_CONVENTIONS } from './constants.js';

export interface AiderConfOutput {
  readonly path: string;
  readonly content: string;
}

/**
 * The keys agentsmesh claims in `.aider.conf.yml` for this run. A `read:` entry
 * in the home config resolves against the working directory rather than the
 * home directory, so the rules wiring is project scope only.
 */
export function projectAiderConf(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): Record<string, unknown> {
  const keys: Record<string, unknown> = {};
  if (
    scope !== 'global' &&
    enabledFeatures.has('rules') &&
    buildAiderConventions(canonical) !== ''
  ) {
    keys.read = [AIDER_CONVENTIONS];
  }
  if (enabledFeatures.has('hooks')) {
    Object.assign(keys, projectAiderHooks(canonical.hooks).keys);
  }
  return keys;
}

/** Sync emitter: everything agentsmesh wants to write into the config. */
export function emitAiderConf(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): AiderConfOutput[] {
  const keys = projectAiderConf(canonical, scope, enabledFeatures);
  if (Object.keys(keys).length === 0) return [];
  return [{ path: AIDER_CONF_FILE, content: stringifyYaml(keys) }];
}

/** Async pass: clears the keys agentsmesh marked once it manages none of them. */
export const clearAiderConf: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
): Promise<GenerateResult[]> => {
  if (Object.keys(projectAiderConf(canonical, scope, enabledFeatures)).length > 0) return [];
  const existing = await readFileSafe(join(projectRoot, AIDER_CONF_FILE));
  // No file means nothing was ever marked, so there is nothing to clear here —
  // and emitting would create an empty config where the user had none.
  if (existing === null || !hasManagedAiderKeys(existing)) return [];

  const content = mergeAiderConf(existing, '');
  return [
    {
      target: AIDER_TARGET,
      path: AIDER_CONF_FILE,
      content,
      currentContent: existing,
      status: computeStatus(existing, content),
    },
  ];
};
