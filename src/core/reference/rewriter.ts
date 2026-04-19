/**
 * Reference rewriting for generated outputs — **project and global scope share one pipeline**.
 *
 * **Engine (single implementation):** {@link rewriteFileLinks} and `formatLinkPathForDestination`
 * (`link-rebaser.ts`, `link-rebaser-output.ts`). There is no separate global rewriter.
 *
 * **What scope changes:** only the canonical→output **path maps** — `buildReferenceMap`,
 * `buildOutputSourceMap`, and `buildArtifactPathMap` (see `map.ts`, `output-source-map.ts`).
 * Those maps encode where each tool writes files under project vs `~` global layouts.
 *
 * **Exception:** In global mode, outputs under `.agents/skills/` use Codex’s artifact map
 * (`artifactMapTargetForResult`) so relative links match the shared Codex global skill directory;
 * everything else uses the result’s target map as usual.
 *
 * Import uses the same {@link rewriteFileLinks} engine with paths from `import-map` builders
 * instead of generate-time maps.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { rewriteFileLinks } from './link-rebaser.js';
import { buildArtifactPathMap, buildOutputSourceMap } from './output-source-map.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { getBuiltinTargetDefinition } from '../../targets/catalog/builtin-targets.js';

/**
 * Find the owner of a shared artifact path from active targets.
 * Returns the target ID that owns the path, or null if no owner is found.
 */
function findSharedArtifactOwner(
  path: string,
  activeTargets: readonly string[] | undefined,
): string | null {
  if (!activeTargets) return null;

  for (const targetId of activeTargets) {
    const descriptor = getBuiltinTargetDefinition(targetId);
    if (!descriptor?.sharedArtifacts) continue;

    for (const [pathPrefix, role] of Object.entries(descriptor.sharedArtifacts)) {
      if (role === 'owner' && path.startsWith(pathPrefix)) {
        return targetId;
      }
    }
  }
  return null;
}

/**
 * Any result placed under a shared artifact path in global mode must use the owner's artifact map.
 * Falls back to codex-cli for `.agents/skills/` for backward compatibility.
 */
function artifactMapTargetForResult(
  result: GenerateResult,
  scope: TargetLayoutScope,
  activeTargets: readonly string[] | undefined,
): string {
  if (scope === 'global') {
    const owner = findSharedArtifactOwner(result.path, activeTargets);
    if (owner) return owner;
    // Fallback for backward compatibility
    if (result.path.startsWith('.agents/skills/')) {
      return 'codex-cli';
    }
  }
  return result.target;
}

function sourceMapCacheKey(target: string, activeTargets: readonly string[] | undefined): string {
  return `${target}\0${(activeTargets ?? []).join(',')}`;
}

/** Paths that will exist after this generate run (outputs plus ancestor dirs). */
export function collectPlannedPaths(projectRoot: string, results: GenerateResult[]): Set<string> {
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
      explicitCurrentDirLinks: true,
    });

    return rewritten.content === result.content
      ? result
      : { ...result, content: rewritten.content };
  });
}
