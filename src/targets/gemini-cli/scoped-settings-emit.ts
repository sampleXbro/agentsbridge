/**
 * Optional `.gemini/settings.json` sidecar for embedded capabilities — invoked from generate engine.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { getTargetCapabilities } from '../catalog/builtin-targets.js';
import { generateGeminiSettingsFiles } from './generator/settings.js';

export function emitScopedGeminiSettings(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
): ReturnType<typeof generateGeminiSettingsFiles> {
  if (scope === 'project') {
    const caps = getTargetCapabilities('gemini-cli', scope);
    if (caps?.ignore.flavor !== 'settings-embedded') return [];
  }
  return generateGeminiSettingsFiles(canonical);
}
