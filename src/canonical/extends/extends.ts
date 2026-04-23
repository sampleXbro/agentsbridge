/**
 * Load canonical files with extends support. Merges extends then local per PRD section 8.
 */

import { join } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { ResolvedExtend } from '../../config/resolve/resolver.js';
import { resolveExtendPaths } from '../../config/resolve/resolver.js';
import { loadCanonicalFiles } from '../load/loader.js';
import { mergeCanonicalFiles } from '../load/merge.js';
import { loadCanonicalForExtend } from './extend-load.js';
import { applyExtendPick } from './extend-pick.js';
import { loadPacksCanonical } from '../load/pack-load.js';

const FEATURE_TO_KEYS: Record<string, (keyof CanonicalFiles)[]> = {
  rules: ['rules'],
  commands: ['commands'],
  agents: ['agents'],
  skills: ['skills'],
  mcp: ['mcp'],
  permissions: ['permissions'],
  hooks: ['hooks'],
  ignore: ['ignore'],
};

/**
 * Filter canonical files to include only features in the given list.
 * @param canonical - Full canonical files
 * @param features - Feature names to include (rules, commands, etc.)
 * @returns CanonicalFiles with only specified features; others empty/null
 */
export function filterCanonicalByFeatures(
  canonical: CanonicalFiles,
  features: string[],
): CanonicalFiles {
  if (features.length === 0) {
    return emptyCanonical();
  }
  const keys = new Set(features.flatMap((f) => FEATURE_TO_KEYS[f] ?? []));
  return {
    rules: keys.has('rules') ? canonical.rules : [],
    commands: keys.has('commands') ? canonical.commands : [],
    agents: keys.has('agents') ? canonical.agents : [],
    skills: keys.has('skills') ? canonical.skills : [],
    mcp: keys.has('mcp') ? canonical.mcp : null,
    permissions: keys.has('permissions') ? canonical.permissions : null,
    hooks: keys.has('hooks') ? canonical.hooks : null,
    ignore: keys.has('ignore') ? canonical.ignore : [],
  };
}

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

/**
 * Load canonical files from project, merging extends in order then local.
 * extends[0] → extends[1] → … → local .agentsmesh/
 *
 * @param config - Validated config with extends
 * @param configDir - Absolute path to directory containing agentsmesh.yaml
 * @returns Merged CanonicalFiles and resolved extends (for lock checksums)
 * @throws Error if extend path missing or remote
 */
export async function loadCanonicalWithExtends(
  config: ValidatedConfig,
  configDir: string,
  options: { refreshRemoteCache?: boolean } = {},
  canonicalDir = join(configDir, '.agentsmesh'),
): Promise<{ canonical: CanonicalFiles; resolvedExtends: ResolvedExtend[] }> {
  const resolvedExtends = await resolveExtendPaths(config, configDir, {
    refreshCache: options.refreshRemoteCache === true,
  });

  let merged = emptyCanonical();

  for (const ext of resolvedExtends) {
    const extCanonical = await loadCanonicalForExtend(ext);
    const filtered = filterCanonicalByFeatures(extCanonical, ext.features);
    const picked = applyExtendPick(filtered, ext.features, ext.pick, ext.name);
    merged = mergeCanonicalFiles(merged, picked);
  }

  const packsCanonical = await loadPacksCanonical(canonicalDir);
  merged = mergeCanonicalFiles(merged, packsCanonical);

  const localCanonical = await loadCanonicalFiles(canonicalDir);
  merged = mergeCanonicalFiles(merged, localCanonical);

  return { canonical: merged, resolvedExtends };
}
