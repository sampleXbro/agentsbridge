import type { CanonicalFiles } from '../../core/types.js';
import { mergeSettingsJson } from '../../core/generate/settings.js';
import type { GeneratedOutputMerger, TargetLayoutScope } from '../catalog/target-descriptor.js';
import { OPENCODE_CONFIG_FILE, OPENCODE_GLOBAL_CONFIG_FILE } from './constants.js';
import { generateMcp, generatePermissions } from './generator.js';

export const mergeOpenCodeSettings: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== OPENCODE_CONFIG_FILE && resolvedPath !== OPENCODE_GLOBAL_CONFIG_FILE) {
    return null;
  }
  const base = pending?.content ?? existing;
  return base === null ? newContent : mergeSettingsJson(base, newContent);
};

export function emitOpenCodeScopedSettings(
  canonical: CanonicalFiles,
  _scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly { readonly path: string; readonly content: string }[] {
  const content: Record<string, unknown> = {};
  if (enabledFeatures.has('mcp') && canonical.mcp) {
    const generated = generateMcp(canonical)[0];
    if (generated) Object.assign(content, JSON.parse(generated.content) as Record<string, unknown>);
  }
  if (enabledFeatures.has('permissions') && canonical.permissions) {
    const generated = generatePermissions(canonical)[0];
    if (generated) Object.assign(content, JSON.parse(generated.content) as Record<string, unknown>);
  }
  return Object.keys(content).length === 0
    ? []
    : [{ path: OPENCODE_CONFIG_FILE, content: JSON.stringify(content, null, 2) }];
}
