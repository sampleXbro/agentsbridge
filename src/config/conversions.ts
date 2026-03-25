import type { ValidatedConfig } from './schema.js';

const DEFAULT_COMMANDS_TO_SKILLS = {
  'codex-cli': true,
} as const;

const DEFAULT_AGENTS_TO_SKILLS = {
  'gemini-cli': false, // native .gemini/agents/*.md per agent-structures
  cline: true,
  'codex-cli': false, // native .codex/agents/*.toml per agent-structures
  windsurf: true,
} as const;

type CommandsToSkillsTarget = keyof typeof DEFAULT_COMMANDS_TO_SKILLS;
type AgentsToSkillsTarget = keyof typeof DEFAULT_AGENTS_TO_SKILLS;

function hasOwnTarget<T extends string>(map: Record<T, boolean>, target: string): target is T {
  return Object.prototype.hasOwnProperty.call(map, target);
}

export function usesCommandSkillProjection(target: string): target is CommandsToSkillsTarget {
  return hasOwnTarget(DEFAULT_COMMANDS_TO_SKILLS, target);
}

export function usesAgentSkillProjection(target: string): target is AgentsToSkillsTarget {
  return hasOwnTarget(DEFAULT_AGENTS_TO_SKILLS, target);
}

export function shouldConvertCommandsToSkills(config: ValidatedConfig, target: string): boolean {
  if (!usesCommandSkillProjection(target)) return false;
  return config.conversions?.commands_to_skills?.[target] ?? DEFAULT_COMMANDS_TO_SKILLS[target];
}

export function shouldConvertAgentsToSkills(config: ValidatedConfig, target: string): boolean {
  if (!usesAgentSkillProjection(target)) return false;
  return config.conversions?.agents_to_skills?.[target] ?? DEFAULT_AGENTS_TO_SKILLS[target];
}
