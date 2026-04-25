import type { ValidatedConfig } from './schema.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

const DEFAULT_COMMANDS_TO_SKILLS: Record<string, boolean> = {
  'codex-cli': true,
};

const DEFAULT_AGENTS_TO_SKILLS: Record<string, boolean> = {
  'gemini-cli': false, // native .gemini/agents/*.md per agent-structures
  cline: true,
  'codex-cli': false, // native .codex/agents/*.toml per agent-structures
  windsurf: true,
};

export function usesCommandSkillProjection(target: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULT_COMMANDS_TO_SKILLS, target);
}

export function usesAgentSkillProjection(target: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULT_AGENTS_TO_SKILLS, target);
}

type ConversionValue = boolean | { project?: boolean; global?: boolean };

function resolveConversionValue(
  value: ConversionValue | undefined,
  scope: TargetLayoutScope,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value[scope];
}

/**
 * @param defaultEnabled - For plugin targets not in the builtin map, use this
 *   as the fallback when the user hasn't set an explicit config override.
 */
export function shouldConvertCommandsToSkills(
  config: ValidatedConfig,
  target: string,
  defaultEnabled?: boolean,
  scope: TargetLayoutScope = 'project',
): boolean {
  const raw = (
    config.conversions?.commands_to_skills as Record<string, ConversionValue> | undefined
  )?.[target];
  const configVal = resolveConversionValue(raw, scope);
  if (configVal !== undefined) return configVal;
  if (usesCommandSkillProjection(target)) return DEFAULT_COMMANDS_TO_SKILLS[target]!;
  return defaultEnabled ?? false;
}

/**
 * @param defaultEnabled - For plugin targets not in the builtin map, use this
 *   as the fallback when the user hasn't set an explicit config override.
 */
export function shouldConvertAgentsToSkills(
  config: ValidatedConfig,
  target: string,
  defaultEnabled?: boolean,
  scope: TargetLayoutScope = 'project',
): boolean {
  const raw = (
    config.conversions?.agents_to_skills as Record<string, ConversionValue> | undefined
  )?.[target];
  const configVal = resolveConversionValue(raw, scope);
  if (configVal !== undefined) return configVal;
  if (usesAgentSkillProjection(target)) return DEFAULT_AGENTS_TO_SKILLS[target]!;
  return defaultEnabled ?? false;
}
