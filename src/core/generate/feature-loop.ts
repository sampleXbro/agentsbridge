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
import { outputMergeOptions, type OutputMergeOptions } from './merge-policy.js';

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

/** Emits at an already-resolved path, applying the merge policy and pending-result dedup. */
async function pushMergedResult(
  results: GenerateResult[],
  target: string,
  resolvedPath: string,
  newContent: string,
  projectRoot: string,
  options?: OutputMergeOptions,
): Promise<void> {
  const existing = await readFileSafe(join(projectRoot, resolvedPath));
  const pendingIdx = results.findIndex((r) => r.path === resolvedPath && r.target === target);
  const pendingResult = pendingIdx >= 0 ? results[pendingIdx] : undefined;
  const content =
    options?.mergeContent?.(existing, pendingResult, newContent, resolvedPath) ?? newContent;
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
}

export async function emitGeneratedOutput(
  results: GenerateResult[],
  target: string,
  out: { readonly path: string; readonly content: string },
  projectRoot: string,
  scope: TargetLayoutScope,
  options?: OutputMergeOptions,
): Promise<string | null> {
  const resolvedPath = resolveGeneratedOutputPath(target, out.path, scope);
  if (resolvedPath === null) return null;
  await pushMergedResult(results, target, resolvedPath, out.content, projectRoot, options);
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
    // Same merge policy the permissions/hooks/scoped-settings paths use: a target
    // writing into a file the user also owns must never replace it wholesale.
    const options = outputMergeOptions(target);
    for (const out of gen(canonical, ctx)) {
      const resolvedPath = await emitGeneratedOutput(
        results,
        target,
        out,
        projectRoot,
        scope,
        options,
      );
      if (resolvedPath === null) continue;
      // `getTargetLayout` already falls back to the plugin registry via
      // `getDescriptor`, so no separate descriptor lookup is needed.
      const layout = getTargetLayout(target, scope);
      if (layout?.mirrorGlobalPath) {
        const raw = layout.mirrorGlobalPath(resolvedPath, targets);
        const mirrorPaths = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
        for (const mirrorPath of mirrorPaths) {
          // Mirror paths are already resolved, so they skip path rewriting but keep
          // the merge policy and pending-result dedup.
          await pushMergedResult(results, target, mirrorPath, out.content, projectRoot, options);
        }
      }
    }
  }
}
