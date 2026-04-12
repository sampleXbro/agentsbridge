import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { normalize as normalizePath } from 'node:path';
import { buildImportReferenceMap } from './import-map.js';
import { rewriteFileLinks } from './link-rebaser.js';

const IMPORT_REFERENCE_TARGETS = [
  'claude-code',
  'cursor',
  'copilot',
  'continue',
  'junie',
  'kiro',
  'gemini-cli',
  'cline',
  'codex-cli',
  'windsurf',
  'roo-code',
] as const;

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
): Promise<(content: string, sourceFile: string, destinationFile: string) => string> {
  const refs = new Map<string, string>();
  const targets = Array.from(new Set([target, ...IMPORT_REFERENCE_TARGETS]));
  for (const candidate of targets) {
    const candidateRefs = await buildImportReferenceMap(candidate, projectRoot);
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

  return (content: string, sourceFile: string, destinationFile: string) =>
    rewriteFileLinks({
      content,
      projectRoot,
      sourceFile,
      destinationFile,
      translatePath: (absolutePath) => artifactMap.get(absolutePath) ?? absolutePath,
      pathExists: (absolutePath) => artifactMap.has(absolutePath) || existsSync(absolutePath),
    }).content;
}
