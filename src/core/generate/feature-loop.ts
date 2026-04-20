import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  getTargetCapabilities,
  getTargetLayout,
  rewriteGeneratedOutputPath,
} from '../../targets/catalog/builtin-targets.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import type { CapabilityFeatureKey } from '../../targets/catalog/capabilities.js';
import type {
  FeatureGeneratorFn,
  GenerateFeatureContext,
} from '../../targets/catalog/target.interface.js';

export function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

export function featureContext(
  target: string,
  feature: CapabilityFeatureKey,
  scope: TargetLayoutScope,
): GenerateFeatureContext {
  const caps = getTargetCapabilities(target, scope);
  return {
    capability: caps?.[feature] ?? { level: 'none' },
    scope,
  };
}

export async function generateFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  enabled: boolean,
  scope: TargetLayoutScope,
  feature: CapabilityFeatureKey,
  getGen: (target: string) => FeatureGeneratorFn | undefined,
): Promise<void> {
  if (!enabled) return;
  for (const target of targets) {
    const gen = getGen(target);
    if (!gen) continue;
    const ctx = featureContext(target, feature, scope);
    for (const out of gen(canonical, ctx)) {
      const resolvedPath = rewriteGeneratedOutputPath(target, out.path, scope);
      if (resolvedPath === null) continue;
      const existing = await readFileSafe(join(projectRoot, resolvedPath));
      results.push({
        target,
        path: resolvedPath,
        content: out.content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, out.content),
      });
      const layout = getTargetLayout(target, scope);
      if (layout?.mirrorGlobalPath) {
        const mirrorPath = layout.mirrorGlobalPath(resolvedPath, targets);
        if (mirrorPath !== null) {
          const existingMirror = await readFileSafe(join(projectRoot, mirrorPath));
          results.push({
            target,
            path: mirrorPath,
            content: out.content,
            currentContent: existingMirror ?? undefined,
            status: computeStatus(existingMirror, out.content),
          });
        }
      }
    }
  }
}
