import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  getBuiltinTargetDefinition,
  resolveTargetFeatureGenerator,
} from '../../targets/catalog/builtin-targets.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import { emitGeneratedOutput, featureContext } from './feature-loop.js';
import { SETTINGS_JSON_PATHS, mergeSettingsJson } from './settings.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

function mergeOutputContent(
  target: string,
  existing: string | null,
  pending: GenerateResult | undefined,
  newContent: string,
  resolvedPath: string,
): string {
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  const merged = descriptor?.mergeGeneratedOutputContent?.(
    existing,
    pending,
    newContent,
    resolvedPath,
  );
  if (merged !== null && merged !== undefined) return merged;
  const base = pending?.content ?? existing;
  return base !== null && SETTINGS_JSON_PATHS.includes(resolvedPath)
    ? mergeSettingsJson(base, newContent)
    : newContent;
}

export async function generatePermissionsFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
): Promise<void> {
  for (const target of targets) {
    const gen =
      resolveTargetFeatureGenerator(target, 'permissions', undefined, scope) ??
      getDescriptor(target)?.generators.generatePermissions;
    if (!gen) continue;
    for (const out of gen(canonical)) {
      await emitGeneratedOutput(results, target, out, projectRoot, scope, {
        mergeContent: (existing, pending, newContent, resolvedPath) =>
          mergeOutputContent(target, existing, pending, newContent, resolvedPath),
      });
    }
  }
}

export async function generateHooksFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
  config: ValidatedConfig,
): Promise<void> {
  for (const target of targets) {
    const gen =
      resolveTargetFeatureGenerator(target, 'hooks', config, scope) ??
      getDescriptor(target)?.generators.generateHooks;
    if (!gen) continue;
    const ctx = featureContext(target, 'hooks', scope);
    let outputs = [...gen(canonical, ctx)];
    const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
    const post = descriptor?.postProcessHookOutputs;
    if (post) {
      outputs = [...(await post(projectRoot, canonical, outputs))];
    }
    for (const out of outputs) {
      await emitGeneratedOutput(results, target, out, projectRoot, scope, {
        mergeContent: (existing, pending, newContent, resolvedPath) =>
          mergeOutputContent(target, existing, pending, newContent, resolvedPath),
      });
    }
  }
}

export async function generateScopedSettingsFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
): Promise<void> {
  for (const target of targets) {
    const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
    const emit = descriptor?.emitScopedSettings;
    if (!emit) continue;
    const outputs = emit(canonical, scope);
    if (outputs.length === 0) continue;
    for (const out of outputs) {
      await emitGeneratedOutput(results, target, out, projectRoot, scope, {
        mergeContent: (existing, pending, newContent, resolvedPath) =>
          mergeOutputContent(target, existing, pending, newContent, resolvedPath),
      });
    }
  }
}
