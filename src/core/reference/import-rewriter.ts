import { existsSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalize as normalizePath } from 'node:path';
import { buildImportReferenceMap } from './import-map.js';
import { rewriteFileLinks } from './link-rebaser.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { TARGET_IDS } from '../../targets/catalog/target-ids.js';

function pathVariants(path: string): string[] {
  const variants = [normalizePath(path)];
  if (!existsSync(path)) return variants;
  try {
    const realPaths = [realpathSync(path), realpathSync.native(path)];
    for (const realPath of realPaths) {
      const normalized = normalizePath(realPath);
      if (!variants.includes(normalized)) variants.push(normalized);
    }
  } catch {
    // Keep the direct path variant when realpath lookup fails.
  }
  return variants;
}

export async function createImportReferenceNormalizer(
  target: string,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<(content: string, sourceFile: string, destinationFile: string) => string> {
  const refs = new Map<string, string>();
  const targets = Array.from(new Set([target, ...TARGET_IDS]));
  for (const candidate of targets) {
    const candidateRefs = await buildImportReferenceMap(candidate, projectRoot, scope);
    for (const [targetPath, canonicalPath] of candidateRefs.entries()) {
      refs.set(targetPath, canonicalPath);
    }
  }
  const artifactMap = new Map<string, string>();
  for (const [targetPath, canonicalPath] of refs.entries()) {
    const canonicalAbsPath = normalizePath(join(projectRoot, canonicalPath));
    for (const variant of pathVariants(join(projectRoot, targetPath))) {
      artifactMap.set(variant, canonicalAbsPath);
    }
  }

  /** Import will materialize these canonical paths; treat as existing so links prefer ./… under .agentsmesh/. */
  const canonicalDestAbs = new Set<string>();
  for (const canonicalPath of new Set(refs.values())) {
    const abs = normalizePath(join(projectRoot, canonicalPath));
    canonicalDestAbs.add(abs);
    for (const variant of pathVariants(abs)) {
      canonicalDestAbs.add(normalizePath(variant));
    }
  }

  return (content: string, sourceFile: string, destinationFile: string) =>
    rewriteFileLinks({
      content,
      projectRoot,
      sourceFile,
      destinationFile,
      translatePath: (absolutePath) => artifactMap.get(absolutePath) ?? absolutePath,
      pathExists: (absolutePath) => {
        const normalized = normalizePath(absolutePath);
        return (
          artifactMap.has(absolutePath) ||
          artifactMap.has(normalized) ||
          existsSync(absolutePath) ||
          canonicalDestAbs.has(normalized)
        );
      },
      explicitCurrentDirLinks: false,
      rewriteBarePathTokens: true,
      scope,
      pathIsDirectory: (absolutePath) => {
        try {
          return statSync(absolutePath).isDirectory();
        } catch {
          return false;
        }
      },
    }).content;
}
