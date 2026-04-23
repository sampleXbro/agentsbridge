import type { TargetLayout } from './target-descriptor.js';

/** Paths that receive the same primary root appendix as `rootInstructionPath`. */
export function getAdditionalRootDecorationPaths(
  layout: TargetLayout | undefined,
): readonly string[] {
  if (!layout) return [];
  if (layout.outputFamilies?.length) {
    return layout.outputFamilies
      .filter((f) => f.kind === 'additional')
      .flatMap((f) => [...(f.explicitPaths ?? [])]);
  }
  return [...(layout.additionalRootDecorationPaths ?? [])];
}

/** Stable family id for reference rewrite cache keys (per-output-family maps). */
export function resolveRewriteFamilyId(
  layout: TargetLayout | undefined,
  outputPath: string,
): string {
  for (const fam of layout?.outputFamilies ?? []) {
    if (fam.pathPrefix !== undefined && outputPath.startsWith(fam.pathPrefix)) {
      return fam.id;
    }
    if (fam.explicitPaths?.includes(outputPath)) {
      return fam.id;
    }
  }
  return 'default';
}
