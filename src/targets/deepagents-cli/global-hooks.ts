/**
 * Global-scope hooks support for Deep Agents CLI.
 *
 * `~/.deepagents/hooks.json` is the ONLY documented hooks config location
 * (docs.langchain.com/oss/javascript/deepagents/code/hooks) — there is no
 * project-level hooks surface at all. So this is wired independently of a
 * plain `generateHooks` (see `globalSupport.scopeExtras`, gated on
 * `scope === 'global'`) rather than letting a project-shaped generator leak
 * into project scope, where hooks capability is 'none'.
 */

import { join, dirname } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles, GenerateResult, ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { mkdirp, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { computeStatus } from '../../core/generate/feature-loop.js';
import { toDeepagentsHooks, deepagentsHooksToCanonical } from './hooks-format.js';
import {
  DEEPAGENTS_CLI_TARGET,
  DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
  DEEPAGENTS_CLI_CANONICAL_HOOKS,
} from './constants.js';

export async function deepagentsCliScopeExtras(
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): Promise<GenerateResult[]> {
  if (scope !== 'global') return [];
  if (!enabledFeatures.has('hooks')) return [];
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];

  const hooks = toDeepagentsHooks(canonical.hooks);
  if (hooks.length === 0) return [];

  const content = JSON.stringify({ hooks }, null, 2);
  const existing = await readFileSafe(join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE));
  return [
    {
      target: DEEPAGENTS_CLI_TARGET,
      path: DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
}

/** Import `~/.deepagents/hooks.json` (global-only) into canonical `hooks.yaml`. */
export async function importDeepagentsCliGlobalHooks(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const srcPath = join(projectRoot, DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE);
  const content = await readFileSafe(srcPath);
  if (!content) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') return;
  const hooks = deepagentsHooksToCanonical((parsed as Record<string, unknown>).hooks);
  if (Object.keys(hooks).length === 0) return;

  const destPath = join(projectRoot, DEEPAGENTS_CLI_CANONICAL_HOOKS);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, yamlStringify(hooks));
  results.push({
    fromTool: DEEPAGENTS_CLI_TARGET,
    fromPath: srcPath,
    toPath: DEEPAGENTS_CLI_CANONICAL_HOOKS,
    feature: 'hooks',
  });
}
