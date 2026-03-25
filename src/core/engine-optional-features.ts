import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from './types.js';
import { readFileSafe } from '../utils/fs.js';
import { addHookScriptAssets } from '../targets/copilot/hook-assets.js';
import { GEMINI_SETTINGS } from '../targets/gemini-cli/constants.js';
import { getTarget } from '../targets/registry.js';
import { computeStatus } from './engine-feature-loop.js';
import {
  SETTINGS_JSON_PATHS,
  mergeSettingsJson,
  mergeGeminiSettingsJson,
} from './engine-settings.js';

export async function generatePermissionsFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
): Promise<void> {
  for (const target of targets) {
    let t;
    try {
      t = getTarget(target);
    } catch {
      continue;
    }
    const gen = t.generatePermissions;
    if (!gen) continue;
    for (const out of gen(canonical)) {
      const existing = await readFileSafe(join(projectRoot, out.path));
      const content =
        existing !== null && SETTINGS_JSON_PATHS.includes(out.path)
          ? mergeSettingsJson(existing, out.content)
          : out.content;
      results.push({
        target,
        path: out.path,
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
): Promise<void> {
  for (const target of targets) {
    let t;
    try {
      t = getTarget(target);
    } catch {
      continue;
    }
    const gen = t.generateHooks;
    if (!gen) continue;
    const outputs =
      target === 'copilot'
        ? await addHookScriptAssets(projectRoot, canonical, gen(canonical))
        : gen(canonical);
    for (const out of outputs) {
      const existing = await readFileSafe(join(projectRoot, out.path));
      let content = out.content;
      if (SETTINGS_JSON_PATHS.includes(out.path)) {
        const pendingIdx = results.findIndex((r) => r.path === out.path && r.target === target);
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
        path: out.path,
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
): Promise<void> {
  for (const target of targets) {
    if (target !== 'gemini-cli') continue;
    let t;
    try {
      t = getTarget(target);
    } catch {
      continue;
    }
    const gen = t.generateSettings;
    if (!gen) continue;
    const outputs = gen(canonical);
    if (outputs.length === 0) continue;
    for (const out of outputs) {
      const existing = await readFileSafe(join(projectRoot, out.path));
      const content =
        existing !== null && out.path === GEMINI_SETTINGS
          ? mergeGeminiSettingsJson(existing, out.content)
          : out.content;
      results.push({
        target,
        path: out.path,
        content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, content),
      });
    }
  }
}
