import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  getTargetCapabilities,
  getTargetLayout,
  rewriteGeneratedOutputPath,
} from '../../targets/catalog/builtin-targets.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
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

export function resolveGeneratedOutputPath(
  target: string,
  path: string,
  scope: TargetLayoutScope,
): string | null {
  let resolvedPath = rewriteGeneratedOutputPath(target, path, scope);
  if (resolvedPath !== null) return resolvedPath;

  const desc = getDescriptor(target);
  if (!desc) return null;
  const layout = scope === 'global' ? desc.globalSupport?.layout : desc.project;
  if (!layout) return null;
  resolvedPath = layout.rewriteGeneratedPath ? layout.rewriteGeneratedPath(path) : path;
  return resolvedPath;
}

export async function emitGeneratedOutput(
  results: GenerateResult[],
  target: string,
  out: { readonly path: string; readonly content: string },
  projectRoot: string,
  scope: TargetLayoutScope,
  options?: {
    readonly mergeContent?: (
      existing: string | null,
      pending: GenerateResult | undefined,
      newContent: string,
      resolvedPath: string,
    ) => string;
  },
): Promise<string | null> {
  const resolvedPath = resolveGeneratedOutputPath(target, out.path, scope);
  if (resolvedPath === null) return null;

  const existing = await readFileSafe(join(projectRoot, resolvedPath));
  const pendingIdx = results.findIndex((r) => r.path === resolvedPath && r.target === target);
  const pendingResult = pendingIdx >= 0 ? results[pendingIdx] : undefined;
  const content =
    options?.mergeContent?.(existing, pendingResult, out.content, resolvedPath) ?? out.content;
  if (pendingIdx >= 0) {
    results.splice(pendingIdx, 1);
  }
  results.push({
    target,
    path: resolvedPath,
    content,
    currentContent: existing ?? undefined,
    status: computeStatus(existing, content),
  });
  return resolvedPath;
}

export function featureContext(
  target: string,
  feature: CapabilityFeatureKey,
  scope: TargetLayoutScope,
): GenerateFeatureContext {
  // `getTargetCapabilities` already falls back to the plugin registry via
  // `getDescriptor`, so no further fallback is needed here.
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
      const resolvedPath = await emitGeneratedOutput(results, target, out, projectRoot, scope);
      if (resolvedPath === null) continue;
      // `getTargetLayout` already falls back to the plugin registry via
      // `getDescriptor`, so no separate descriptor lookup is needed.
      const layout = getTargetLayout(target, scope);
      if (layout?.mirrorGlobalPath) {
        const raw = layout.mirrorGlobalPath(resolvedPath, targets);
        const mirrorPaths = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
        for (const mirrorPath of mirrorPaths) {
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
