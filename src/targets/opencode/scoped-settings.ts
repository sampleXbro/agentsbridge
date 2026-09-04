import { z } from 'zod';
import type { CanonicalFiles } from '../../core/types.js';
import type { GeneratedOutputMerger, TargetLayoutScope } from '../catalog/target-descriptor.js';
import { OPENCODE_CONFIG_FILE, OPENCODE_GLOBAL_CONFIG_FILE } from './constants.js';
import {
  generateMcp,
  generatePermissions,
  generateInstructions,
  generateIgnore,
} from './generator.js';

// OpenCode's own schema — NOT Claude's (`permissions`/plural) or Gemini's
// (`mcpServers`). Using the generic `mergeSettingsJson` here previously
// dropped every regenerated `mcp`/`permission`/`instructions` key on any
// generate pass after the first, because that helper only carries over
// Claude-shaped `permissions`/`hooks` keys from incoming content.
const openCodeIncomingSchema = z
  .object({
    mcp: z.record(z.string(), z.unknown()).optional(),
    permission: z.record(z.string(), z.unknown()).optional(),
    instructions: z.array(z.string()).optional(),
  })
  .passthrough();

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

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
  if (base === null) return newContent;
  const merged = parseJsonObject(base);
  const incoming = openCodeIncomingSchema.parse(JSON.parse(newContent));
  if (incoming.mcp !== undefined) merged.mcp = incoming.mcp;
  if (incoming.permission !== undefined) {
    // Per-tool merge, not whole-key replace: `permission` is shared between the
    // permissions and ignore features, and a user may hand-write rules for tools
    // agentsmesh emits nothing for (e.g. `bash`). Generated tools still win.
    const existingPermission = isRuleMap(merged.permission) ? merged.permission : {};
    merged.permission = { ...existingPermission, ...incoming.permission };
  }
  if (incoming.instructions !== undefined) merged.instructions = incoming.instructions;
  return JSON.stringify(merged, null, 2);
};

function readPermission(output: { content: string } | undefined): Record<string, unknown> {
  if (!output) return {};
  const parsed = JSON.parse(output.content) as { permission?: Record<string, unknown> };
  return parsed.permission ?? {};
}

function isRuleMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ignore rules and canonical permissions share the `permission` key. When both
 * touch the same tool, the blanket action becomes the `"*"` catch-all so the
 * ignore rules still match last and win.
 */
function withIgnoreRules(
  permission: Record<string, unknown>,
  ignoreRules: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...permission };
  for (const [tool, rules] of Object.entries(ignoreRules)) {
    const blanket = merged[tool];
    merged[tool] =
      typeof blanket === 'string' && isRuleMap(rules) ? { '*': blanket, ...rules } : rules;
  }
  return merged;
}

export function emitOpenCodeScopedSettings(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly { readonly path: string; readonly content: string }[] {
  const content: Record<string, unknown> = {};
  if (enabledFeatures.has('rules')) {
    const generated = generateInstructions(canonical, scope)[0];
    if (generated) Object.assign(content, JSON.parse(generated.content) as Record<string, unknown>);
  }
  if (enabledFeatures.has('mcp') && canonical.mcp) {
    const generated = generateMcp(canonical)[0];
    if (generated) Object.assign(content, JSON.parse(generated.content) as Record<string, unknown>);
  }
  let permission: Record<string, unknown> = {};
  if (enabledFeatures.has('permissions') && canonical.permissions) {
    permission = readPermission(generatePermissions(canonical)[0]);
  }
  if (enabledFeatures.has('ignore')) {
    permission = withIgnoreRules(permission, readPermission(generateIgnore(canonical)[0]));
  }
  if (Object.keys(permission).length > 0) content.permission = permission;
  return Object.keys(content).length === 0
    ? []
    : [{ path: OPENCODE_CONFIG_FILE, content: JSON.stringify(content, null, 2) }];
}
