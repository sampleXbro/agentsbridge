import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { rewriteFileLinks } from './link-rebaser.js';
import { buildArtifactPathMap, buildOutputSourceMap } from './output-source-map.js';

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

function artifactCacheKey(result: GenerateResult): string {
  return result.target === 'copilot' && result.path.startsWith('.github/instructions/')
    ? `${result.target}:instructions`
    : result.target;
}

export function rewriteGeneratedReferences(
  results: GenerateResult[],
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  projectRoot: string,
): GenerateResult[] {
  const plannedPaths = collectPlannedPaths(projectRoot, results);
  const artifactCache = new Map<string, Map<string, string>>();
  const sourceCache = new Map<string, Map<string, string>>();

  return results.map((result) => {
    const sourceMap =
      sourceCache.get(result.target) ??
      (() => {
        const built = buildOutputSourceMap(result.target, canonical, config);
        sourceCache.set(result.target, built);
        return built;
      })();
    const sourceFile = sourceMap.get(result.path);
    if (!sourceFile) return result;

    const cacheKey = artifactCacheKey(result);
    const artifactMap =
      artifactCache.get(cacheKey) ??
      (() => {
        const built = buildArtifactPathMap(
          result.target,
          canonical,
          config,
          projectRoot,
          result.path,
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
