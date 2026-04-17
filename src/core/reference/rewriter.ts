import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { rewriteFileLinks } from './link-rebaser.js';
import { buildArtifactPathMap, buildOutputSourceMap } from './output-source-map.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

const CODEX_CLI = 'codex-cli';

/**
 * Any result placed under `.agents/skills/` in global mode must use codex-cli's artifact map
 * because `.agents/skills/` is codex-cli's global skillDir. Using the originating target's map
 * (e.g. kiro → `.kiro/skills/`) would produce wrong relative links from the `.agents/skills/`
 * destination (e.g. `../../../.kiro/skills/x/references/` instead of `references/`).
 */
function artifactMapTargetForResult(
  result: GenerateResult,
  scope: TargetLayoutScope,
  _activeTargets: readonly string[] | undefined,
): string {
  if (scope === 'global' && result.path.startsWith('.agents/skills/')) {
    return CODEX_CLI;
  }
  return result.target;
}

function sourceMapCacheKey(target: string, activeTargets: readonly string[] | undefined): string {
  return `${target}\0${(activeTargets ?? []).join(',')}`;
}

function collectPlannedPaths(projectRoot: string, results: GenerateResult[]): Set<string> {
  const planned = new Set<string>();
  for (const result of results) {
    const absolutePath = join(projectRoot, result.path);
    planned.add(absolutePath);
    let current = dirname(absolutePath);
    while (current.startsWith(projectRoot) && !planned.has(current)) {
      planned.add(current);
      if (current === projectRoot) break;
      current = dirname(current);
    }
  }
  return planned;
}

function artifactCacheKey(
  result: GenerateResult,
  scope: TargetLayoutScope,
  activeTargets: readonly string[] | undefined,
): string {
  if (result.target === 'copilot' && result.path.startsWith('.github/instructions/')) {
    return `${result.target}:instructions`;
  }
  const via = artifactMapTargetForResult(result, scope, activeTargets);
  return via === result.target ? result.target : `${result.target}~via~${via}`;
}

export function rewriteGeneratedReferences(
  results: GenerateResult[],
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
  activeTargets?: readonly string[],
): GenerateResult[] {
  const plannedPaths = collectPlannedPaths(projectRoot, results);
  const artifactCache = new Map<string, Map<string, string>>();
  const sourceCache = new Map<string, Map<string, string>>();

  return results.map((result) => {
    const smKey = sourceMapCacheKey(result.target, activeTargets);
    const sourceMap =
      sourceCache.get(smKey) ??
      (() => {
        const built = buildOutputSourceMap(result.target, canonical, config, scope, activeTargets);
        sourceCache.set(smKey, built);
        return built;
      })();
    const sourceFile = sourceMap.get(result.path);
    if (!sourceFile) return result;

    const artifactMapTarget = artifactMapTargetForResult(result, scope, activeTargets);
    const cacheKey = artifactCacheKey(result, scope, activeTargets);
    const artifactMap =
      artifactCache.get(cacheKey) ??
      (() => {
        const built = buildArtifactPathMap(
          artifactMapTarget,
          canonical,
          config,
          projectRoot,
          result.path,
          { scope },
        );
        artifactCache.set(cacheKey, built);
        return built;
      })();
    const rewritten = rewriteFileLinks({
      content: result.content,
      projectRoot,
      sourceFile,
      destinationFile: join(projectRoot, result.path),
      translatePath: (absolutePath) => artifactMap.get(absolutePath) ?? absolutePath,
      pathExists: (absolutePath) => plannedPaths.has(absolutePath) || existsSync(absolutePath),
    });

    return rewritten.content === result.content
      ? result
      : { ...result, content: rewritten.content };
  });
}
