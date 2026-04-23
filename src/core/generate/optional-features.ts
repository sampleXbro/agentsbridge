import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  getBuiltinTargetDefinition,
  resolveTargetFeatureGenerator,
  rewriteGeneratedOutputPath,
} from '../../targets/catalog/builtin-targets.js';
import { GEMINI_SETTINGS } from '../../targets/gemini-cli/constants.js';
import { computeStatus, featureContext } from './feature-loop.js';
import { SETTINGS_JSON_PATHS, mergeSettingsJson, mergeGeminiSettingsJson } from './settings.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export async function generatePermissionsFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
): Promise<void> {
  for (const target of targets) {
    const gen = resolveTargetFeatureGenerator(target, 'permissions');
    if (!gen) continue;
    for (const out of gen(canonical)) {
      const resolvedPath = rewriteGeneratedOutputPath(target, out.path, scope);
      if (resolvedPath === null) continue;
      const existing = await readFileSafe(join(projectRoot, resolvedPath));
      const content =
        existing !== null && SETTINGS_JSON_PATHS.includes(resolvedPath)
          ? mergeSettingsJson(existing, out.content)
          : out.content;
      results.push({
        target,
        path: resolvedPath,
        content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, content),
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
    const gen = resolveTargetFeatureGenerator(target, 'hooks', config);
    if (!gen) continue;
    const ctx = featureContext(target, 'hooks', scope);
    let outputs = [...gen(canonical, ctx)];
    const post = getBuiltinTargetDefinition(target)?.postProcessHookOutputs;
    if (post) {
      outputs = [...(await post(projectRoot, canonical, outputs))];
    }
    for (const out of outputs) {
      const resolvedPath = rewriteGeneratedOutputPath(target, out.path, scope);
      if (resolvedPath === null) continue;
      const existing = await readFileSafe(join(projectRoot, resolvedPath));
      let content = out.content;
      if (SETTINGS_JSON_PATHS.includes(resolvedPath)) {
        const pendingIdx = results.findIndex((r) => r.path === resolvedPath && r.target === target);
        const pendingResult = pendingIdx >= 0 ? results[pendingIdx] : undefined;
        const base = pendingResult?.content ?? existing;
        if (base !== null) {
          content = mergeSettingsJson(base, out.content);
        }
        if (pendingIdx >= 0) {
          results.splice(pendingIdx, 1);
        }
      }
      results.push({
        target,
        path: resolvedPath,
        content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, content),
      });
    }
  }
}

export async function generateGeminiSettingsFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
): Promise<void> {
  for (const target of targets) {
    const emit = getBuiltinTargetDefinition(target)?.emitScopedSettings;
    if (!emit) continue;
    const outputs = emit(canonical, scope);
    if (outputs.length === 0) continue;
    for (const out of outputs) {
      const resolvedPath = rewriteGeneratedOutputPath(target, out.path, scope);
      if (resolvedPath === null) continue;
      const existing = await readFileSafe(join(projectRoot, resolvedPath));
      const content =
        existing !== null && resolvedPath === GEMINI_SETTINGS
          ? mergeGeminiSettingsJson(existing, out.content)
          : out.content;
      results.push({
        target,
        path: resolvedPath,
        content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, content),
      });
    }
  }
}
