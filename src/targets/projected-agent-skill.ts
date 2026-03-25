import type { CanonicalAgent, Hooks } from '../core/types.js';
import { serializeFrontmatter } from '../utils/markdown.js';

export const PROJECTED_AGENT_SKILL_PREFIX = 'ab-agent-';
export const LEGACY_PROJECTED_AGENT_SKILL_PREFIX = 'ab-agent-';

interface ParsedProjectedAgent {
  name: string;
  description: string;
  tools: string[];
  disallowedTools: string[];
  model: string;
  permissionMode: string;
  maxTurns: number;
  mcpServers: string[];
  hooks: Hooks;
  skills: string[];
  memory: string;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function toHooks(value: unknown): Hooks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const hooks: Hooks = {};
  for (const [event, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) continue;
    hooks[event] = entries.filter(
      (entry): entry is NonNullable<Hooks[string]>[number] =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as Record<string, unknown>).matcher === 'string' &&
        typeof (entry as Record<string, unknown>).command === 'string',
    );
  }
  return hooks;
}

export function projectedAgentSkillDirName(name: string): string {
  return `${PROJECTED_AGENT_SKILL_PREFIX}${name}`;
}

export function serializeProjectedAgentSkill(agent: CanonicalAgent): string {
  const frontmatter: Record<string, unknown> = {
    name: projectedAgentSkillDirName(agent.name),
    description: agent.description || undefined,
    'x-agentsbridge-kind': 'agent',
    'x-agentsbridge-name': agent.name,
    'x-agentsbridge-tools': agent.tools.length > 0 ? agent.tools : undefined,
    'x-agentsbridge-disallowed-tools':
      agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
    'x-agentsbridge-model': agent.model || undefined,
    'x-agentsbridge-permission-mode': agent.permissionMode || undefined,
    'x-agentsbridge-max-turns': agent.maxTurns > 0 ? agent.maxTurns : undefined,
    'x-agentsbridge-mcp-servers': agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
    'x-agentsbridge-hooks': Object.keys(agent.hooks).length > 0 ? agent.hooks : undefined,
    'x-agentsbridge-skills': agent.skills.length > 0 ? agent.skills : undefined,
    'x-agentsbridge-memory': agent.memory || undefined,
  };
  Object.keys(frontmatter).forEach((key) => {
    if (frontmatter[key] === undefined) delete frontmatter[key];
  });
  return serializeFrontmatter(frontmatter, agent.body.trim() || '');
}

export function parseProjectedAgentSkillFrontmatter(
  frontmatter: Record<string, unknown>,
  dirName: string,
): ParsedProjectedAgent | null {
  if (frontmatter['x-agentsbridge-kind'] !== 'agent') return null;

  const metadataName =
    typeof frontmatter['x-agentsbridge-name'] === 'string'
      ? frontmatter['x-agentsbridge-name']
      : '';
  const derivedName = dirName.startsWith(PROJECTED_AGENT_SKILL_PREFIX)
    ? dirName.slice(PROJECTED_AGENT_SKILL_PREFIX.length)
    : dirName.startsWith(LEGACY_PROJECTED_AGENT_SKILL_PREFIX)
      ? dirName.slice(LEGACY_PROJECTED_AGENT_SKILL_PREFIX.length)
      : '';
  const name = (metadataName || derivedName).trim();
  if (!name) return null;

  return {
    name,
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    tools: toStringArray(frontmatter['x-agentsbridge-tools']),
    disallowedTools: toStringArray(frontmatter['x-agentsbridge-disallowed-tools']),
    model:
      typeof frontmatter['x-agentsbridge-model'] === 'string'
        ? frontmatter['x-agentsbridge-model']
        : '',
    permissionMode:
      typeof frontmatter['x-agentsbridge-permission-mode'] === 'string'
        ? frontmatter['x-agentsbridge-permission-mode']
        : '',
    maxTurns:
      typeof frontmatter['x-agentsbridge-max-turns'] === 'number'
        ? frontmatter['x-agentsbridge-max-turns']
        : Number(frontmatter['x-agentsbridge-max-turns'] ?? 0),
    mcpServers: toStringArray(frontmatter['x-agentsbridge-mcp-servers']),
    hooks: toHooks(frontmatter['x-agentsbridge-hooks']),
    skills: toStringArray(frontmatter['x-agentsbridge-skills']),
    memory:
      typeof frontmatter['x-agentsbridge-memory'] === 'string'
        ? frontmatter['x-agentsbridge-memory']
        : '',
  };
}

export function serializeImportedAgent(agent: ParsedProjectedAgent, body: string): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description || undefined,
    tools: agent.tools.length > 0 ? agent.tools : undefined,
    disallowedTools: agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
    model: agent.model || undefined,
    permissionMode: agent.permissionMode || undefined,
    maxTurns: agent.maxTurns > 0 ? agent.maxTurns : undefined,
    mcpServers: agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
    hooks: Object.keys(agent.hooks).length > 0 ? agent.hooks : undefined,
    skills: agent.skills.length > 0 ? agent.skills : undefined,
    memory: agent.memory || undefined,
  };
  Object.keys(frontmatter).forEach((key) => {
    if (frontmatter[key] === undefined) delete frontmatter[key];
  });
  return serializeFrontmatter(frontmatter, body.trim() || '');
}
