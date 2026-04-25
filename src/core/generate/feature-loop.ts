import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  getTargetCapabilities,
  getTargetLayout,
  rewriteGeneratedOutputPath,
} from '../../targets/catalog/builtin-targets.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import { normalizeTargetCapabilities } from '../../targets/catalog/capabilities.js';
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
  let caps = getTargetCapabilities(target, scope);
  if (!caps) {
    // Fall back to registry for plugin targets
    const desc = getDescriptor(target);
    if (desc) {
      const rawCaps =
        scope === 'global'
          ? (desc.globalSupport?.capabilities ?? desc.globalCapabilities ?? desc.capabilities)
          : desc.capabilities;
      caps = normalizeTargetCapabilities(rawCaps);
    }
  }
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
      // rewriteGeneratedOutputPath returns null for unknown targets — fall back to registry
      let resolvedPath = rewriteGeneratedOutputPath(target, out.path, scope);
      if (resolvedPath === null) {
        const desc = getDescriptor(target);
        if (!desc) continue;
        const layout =
          scope === 'global'
            ? (desc.globalSupport?.layout ?? desc.global ?? desc.project)
            : desc.project;
        resolvedPath = layout.rewriteGeneratedPath
          ? layout.rewriteGeneratedPath(out.path)
          : out.path;
        if (resolvedPath === null) continue;
      }
      const existing = await readFileSafe(join(projectRoot, resolvedPath));
      results.push({
        target,
        path: resolvedPath,
        content: out.content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, out.content),
      });
      let layout = getTargetLayout(target, scope);
      if (!layout) {
        const desc = getDescriptor(target);
        layout =
          desc !== undefined
            ? scope === 'global'
              ? (desc.globalSupport?.layout ?? desc.global ?? desc.project)
              : desc.project
            : undefined;
      }
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
